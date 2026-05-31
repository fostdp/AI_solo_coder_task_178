class KineticsFramework {
  constructor(kineticsParams, inhibitionParams, yieldsParams) {
    this.kinetics = kineticsParams;
    this.inhibition = inhibitionParams;
    this.yields = yieldsParams;
  }

  michaelisMenten(substrate, Km) {
    if (substrate <= 0) return 0;
    return substrate / (Km + substrate);
  }

  haldaneEquation(substrate, Ks, Ki) {
    if (substrate <= 0) return 0;
    return substrate / (Ks + substrate + (substrate * substrate) / Ki);
  }

  nonCompetitiveInhibition(substrate, inhibitor, Ks, Ki) {
    if (substrate <= 0) return 0;
    return (substrate / (Ks + substrate)) * (1 / (1 + inhibitor / Ki));
  }

  exponentialInhibition(inhibitor, Ki, threshold = 0) {
    if (inhibitor <= threshold) return 1;
    return Math.exp(-(inhibitor - threshold) / Ki);
  }

  hillEquation(substrate, K, n) {
    if (substrate <= 0) return 0;
    const substrateN = Math.pow(substrate, n);
    const KN = Math.pow(K, n);
    return substrateN / (KN + substrateN);
  }

  calculateGlucoseEffect(glucose) {
    const { Ks_glucose, Ki_glucose } = this.kinetics;
    return this.haldaneEquation(glucose, Ks_glucose, Ki_glucose);
  }

  calculateOxygenEffect(oxygen) {
    const { Ks_oxygen } = this.kinetics;
    return this.michaelisMenten(oxygen, Ks_oxygen);
  }

  calculateLactateInhibition(lactate) {
    const { lactateInhibitionK, lactateInhibitionThreshold } = this.inhibition;
    return this.exponentialInhibition(lactate, lactateInhibitionK, lactateInhibitionThreshold);
  }

  calculatePyruvatePartitioning(oxygen, pyruvateConcentration = 0.1) {
    const oxygenEffect = this.calculateOxygenEffect(oxygen);
    
    const { pyruvateDehydrogenaseActivity, lactateDehydrogenaseActivity } = this.kinetics;
    
    const pdhActivity = pyruvateDehydrogenaseActivity * oxygenEffect;
    const ldhActivity = lactateDehydrogenaseActivity * (1 - oxygenEffect * 0.8);
    
    const oxygenSwitch = Math.exp(-oxygenEffect * 1.5);
    const ldhEnhancement = 1 + oxygenSwitch * 1.5;
    
    const adjustedPdh = pdhActivity;
    const adjustedLdh = ldhActivity * ldhEnhancement;
    
    const totalActivity = adjustedPdh + adjustedLdh;
    const toTca = adjustedPdh / totalActivity;
    const toLactate = adjustedLdh / totalActivity;
    
    return {
      toTca: Math.max(0.05, Math.min(0.95, toTca)),
      toLactate: Math.max(0.05, Math.min(0.95, toLactate)),
      pdhActivity,
      ldhActivity
    };
  }

  calculateGlycolysisRate(glucose, atp, adpRatio = 1) {
    const { maxGlycolysisRate } = this.kinetics;
    const glucoseEffect = this.calculateGlucoseEffect(glucose);
    
    const atpInhibition = 1 / (1 + (atp / 10));
    const pfkRegulation = 0.5 + 0.5 * adpRatio;
    
    return maxGlycolysisRate * glucoseEffect * atpInhibition * pfkRegulation;
  }

  calculateTcaRate(pyruvate, oxygen, nadhRatio = 1) {
    const { maxTcaRate } = this.kinetics;
    const oxygenEffect = this.calculateOxygenEffect(oxygen);
    
    const pyruvateEffect = this.michaelisMenten(pyruvate, 0.5);
    const nadhInhibition = 1 / (1 + nadhRatio * 0.5);
    
    return maxTcaRate * oxygenEffect * pyruvateEffect * nadhInhibition;
  }

  calculateLactateProductionRate(pyruvate, nadh, partitioning) {
    const { maxLactateProductionRate } = this.kinetics;
    const pyruvateEffect = this.michaelisMenten(pyruvate, 1.0);
    const nadhEffect = this.michaelisMenten(nadh, 2.0);
    
    return maxLactateProductionRate * partitioning.toLactate * pyruvateEffect * nadhEffect;
  }

  calculateATPProduction(glycolysisRate, tcaRate, acetateRate = 0) {
    const { Y_atp_glucose_glycolysis, Y_atp_glucose_tca } = this.yields;
    
    const atpFromGlycolysis = glycolysisRate * Y_atp_glucose_glycolysis;
    const atpFromTca = tcaRate * Y_atp_glucose_tca;
    const atpFromAcetate = acetateRate * 1;
    
    return atpFromGlycolysis + atpFromTca + atpFromAcetate;
  }

  calculateGrowthRate(atp, lactate, glucoseEffect, cellCount) {
    const { maxGrowthRate, maintenanceATP } = this.kinetics;
    
    const availableATP = Math.max(0, atp - maintenanceATP);
    const atpEffect = availableATP / (availableATP + 1);
    const lactateEffect = this.calculateLactateInhibition(lactate);
    const densityEffect = 1 / (1 + cellCount / 20);
    
    const growthRate = maxGrowthRate * atpEffect * glucoseEffect * lactateEffect * densityEffect;
    
    return Math.max(0, growthRate);
  }

  calculateOxygenConsumption(tcaRate, cellCount) {
    const { O2_per_glucose_tca } = this.yields;
    return tcaRate * O2_per_glucose_tca * cellCount;
  }

  calculateCarbonBalance(glycolysisRate, tcaRate, lactateRate, biomassRate) {
    const glucoseInput = glycolysisRate;
    const toPyruvate = glycolysisRate * 2;
    const toTca = tcaRate;
    const toLactate = lactateRate;
    const toBiomass = biomassRate * 3;
    
    const totalOutput = toTca + toLactate + toBiomass;
    const balance = toPyruvate - totalOutput;
    
    return {
      glucoseInput,
      toPyruvate,
      toTca,
      toLactate,
      toBiomass,
      balance,
      closure: totalOutput / Math.max(0.001, toPyruvate)
    };
  }

  calculateRedoxBalance(glycolysisRate, tcaRate, lactateRate) {
    const nadhFromGlycolysis = glycolysisRate * 2;
    const nadhFromTca = tcaRate * 8;
    const nadhConsumedByLactate = lactateRate * 1;
    const nadhConsumedByOxPhos = tcaRate * 6;
    
    const totalNADH = nadhFromGlycolysis + nadhFromTca;
    const totalConsumed = nadhConsumedByLactate + nadhConsumedByOxPhos;
    
    return {
      nadhProduced: totalNADH,
      nadhConsumed: totalConsumed,
      redoxState: totalNADH / Math.max(0.001, totalConsumed)
    };
  }

  calculateEnergeticYield(glycolysisRate, tcaRate, growthRate) {
    const atpProduced = this.calculateATPProduction(glycolysisRate, tcaRate);
    const atpForGrowth = growthRate * 50;
    const atpForMaintenance = this.kinetics.maintenanceATP;
    
    return {
      atpProduced,
      atpForGrowth,
      atpForMaintenance,
      atpBalance: atpProduced - atpForGrowth - atpForMaintenance,
      growthYield: atpForGrowth / Math.max(0.001, atpProduced)
    };
  }

  calculateSpecificRates(glycolysisRate, tcaRate, lactateRate, growthRate, cellCount) {
    const normalizedCount = Math.max(0.1, cellCount);
    return {
      specificGlucoseUptake: glycolysisRate,
      specificLactateProduction: lactateRate,
      specificGrowthRate: growthRate / normalizedCount,
      specificOxygenUptake: tcaRate * this.yields.O2_per_glucose_tca,
      specificATPProduction: this.calculateATPProduction(glycolysisRate, tcaRate)
    };
  }

  calculateFluxDistribution(glycolysisRate, tcaRate, lactateRate) {
    const totalCarbon = glycolysisRate * 2;
    return {
      glycolysis: glycolysisRate,
      tca: tcaRate,
      lactate: lactateRate,
      tcaFraction: totalCarbon > 0 ? tcaRate / totalCarbon : 0,
      lactateFraction: totalCarbon > 0 ? lactateRate / totalCarbon : 0,
      respiratoryQuotient: totalCarbon > 0 ? (tcaRate * 3) / (totalCarbon) : 0
    };
  }

  calculatePhenotypicState(glucose, oxygen, lactate, atp, cellCount) {
    const glucoseEffect = this.calculateGlucoseEffect(glucose);
    const oxygenEffect = this.calculateOxygenEffect(oxygen);
    const partitioning = this.calculatePyruvatePartitioning(oxygen);
    
    const glycolysisRate = this.calculateGlycolysisRate(glucose, atp);
    const pyruvateProduction = glycolysisRate * 2;
    
    const tcaRate = Math.min(
      this.kinetics.maxTcaRate,
      pyruvateProduction * partitioning.toTca * oxygenEffect
    );
    const lactateRate = pyruvateProduction * partitioning.toLactate;
    
    const growthRate = this.calculateGrowthRate(atp, lactate, glucoseEffect, cellCount);
    
    const specificRates = this.calculateSpecificRates(
      glycolysisRate, tcaRate, lactateRate, growthRate, cellCount
    );
    
    const fluxDistribution = this.calculateFluxDistribution(
      glycolysisRate, tcaRate, lactateRate
    );
    
    return {
      glucoseEffect,
      oxygenEffect,
      partitioning,
      glycolysisRate,
      pyruvateProduction,
      tcaRate,
      lactateRate,
      growthRate,
      specificRates,
      fluxDistribution
    };
  }

  sensitivityAnalysis(parameter, range, conditions) {
    const { glucose, oxygen, lactate, atp, cellCount } = conditions;
    const results = [];
    const baseValue = this.kinetics[parameter];
    
    for (let factor of range) {
      this.kinetics[parameter] = baseValue * factor;
      const state = this.calculatePhenotypicState(glucose, oxygen, lactate, atp, cellCount);
      results.push({
        factor,
        parameterValue: this.kinetics[parameter],
        growthRate: state.growthRate,
        lactateRate: state.lactateRate,
        tcaRate: state.tcaRate
      });
    }
    
    this.kinetics[parameter] = baseValue;
    return results;
  }

  getMetabolicControlAnalysis(conditions) {
    const { glucose, oxygen, lactate, atp, cellCount } = conditions;
    const baseline = this.calculatePhenotypicState(glucose, oxygen, lactate, atp, cellCount);
    
    const parameters = ['maxGlycolysisRate', 'maxTcaRate', 'Ks_oxygen', 'Ki_glucose'];
    const mcaResults = {};
    
    parameters.forEach(param => {
      const originalValue = this.kinetics[param];
      const delta = originalValue * 0.01;
      
      this.kinetics[param] = originalValue + delta;
      const perturbed = this.calculatePhenotypicState(glucose, oxygen, lactate, atp, cellCount);
      
      const fluxControlCoefficient = 
        ((perturbed.growthRate - baseline.growthRate) / baseline.growthRate) /
        (delta / originalValue);
      
      mcaResults[param] = {
        fluxControlCoefficient,
        elasticity: ((perturbed.tcaRate - baseline.tcaRate) / baseline.tcaRate) / (delta / originalValue)
      };
      
      this.kinetics[param] = originalValue;
    });
    
    return mcaResults;
  }
}

module.exports = KineticsFramework;
