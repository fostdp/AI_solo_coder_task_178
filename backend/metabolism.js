const CellLineParameters = require('./cell_line_parameters');
const KineticsFramework = require('./kinetics_framework');

class MetabolismModel {
  constructor(cellLineId = 'CHO_K1') {
    this.cellLineManager = new CellLineParameters();
    this.cellLineId = cellLineId;
    
    this._initKinetics();
    
    this.state = this._getInitialState();
    this.params = {
      glucoseConc: 25.0,
      dissolvedOxygen: 50.0
    };
    
    this.cultureTime = 0;
    this.snapshots = [];
  }

  _initKinetics() {
    const cellLine = this.cellLineManager.getCellLine(this.cellLineId);
    this.kinetics = new KineticsFramework(
      cellLine.kinetics,
      cellLine.inhibition,
      cellLine.yields
    );
    this.cellLineData = cellLine;
  }

  _getInitialState() {
    return {
      cellCount: 1.0,
      glucose: 25.0,
      lactate: 0.0,
      atp: 2.0,
      pyruvate: 0.1,
      nadh: 0.5,
      dissolvedOxygen: 50.0,
      growthRate: 0.0,
      specificGrowthRate: 0.0,
      glycolysisFlux: 0.0,
      tcaFlux: 0.0,
      lactateFlux: 0.0,
      specificGlucoseUptake: 0.0,
      specificLactateProduction: 0.0,
      pyruvateToTcaRatio: 0.5,
      pyruvateToLactateRatio: 0.5,
      glucoseEffect: 0.0,
      oxygenEffect: 0.0,
      lactateInhibition: 1.0,
      viability: 1.0
    };
  }

  setCellLine(cellLineId) {
    if (this.cellLineManager.setCurrentCellLine(cellLineId)) {
      this.cellLineId = cellLineId;
      this._initKinetics();
      return true;
    }
    return false;
  }

  getCellLineInfo() {
    return {
      id: this.cellLineId,
      name: this.cellLineData.name,
      description: this.cellLineData.description,
      physiological: { ...this.cellLineData.physiological }
    };
  }

  getAvailableCellLines() {
    return this.cellLineManager.getAllCellLines();
  }

  setParams(glucose, dissolvedOxygen) {
    this.params.glucoseConc = glucose;
    this.params.dissolvedOxygen = dissolvedOxygen;
  }

  getState() {
    return { ...this.state };
  }

  getCultureParams() {
    return { ...this.params };
  }

  getDiagnostics() {
    const { glucose, lactate, atp, pyruvate, dissolvedOxygen, cellCount } = this.state;
    
    const carbonBalance = this.kinetics.calculateCarbonBalance(
      this.state.glycolysisFlux,
      this.state.tcaFlux,
      this.state.lactateFlux,
      this.state.growthRate
    );
    
    const redoxBalance = this.kinetics.calculateRedoxBalance(
      this.state.glycolysisFlux,
      this.state.tcaFlux,
      this.state.lactateFlux
    );
    
    const energeticYield = this.kinetics.calculateEnergeticYield(
      this.state.glycolysisFlux,
      this.state.tcaFlux,
      this.state.growthRate
    );

    return {
      carbonBalance,
      redoxBalance,
      energeticYield,
      cultureTime: this.cultureTime,
      cellLineId: this.cellLineId
    };
  }

  step(dt = 0.1) {
    const { cellCount, glucose, lactate, atp, pyruvate, nadh, dissolvedOxygen } = this.state;
    const { glucoseConc } = this.params;

    const phenotypicState = this.kinetics.calculatePhenotypicState(
      glucose,
      dissolvedOxygen,
      lactate,
      atp,
      cellCount
    );

    const {
      glucoseEffect,
      oxygenEffect,
      partitioning,
      glycolysisRate,
      pyruvateProduction,
      tcaRate,
      lactateRate,
      growthRate,
      specificRates
    } = phenotypicState;

    const glucoseConsumption = glycolysisRate * cellCount * dt;
    const oxygenConsumption = this.kinetics.calculateOxygenConsumption(tcaRate, cellCount);
    
    const atpProduction = this.kinetics.calculateATPProduction(glycolysisRate, tcaRate) * dt;
    const atpConsumption = this.cellLineData.kinetics.maintenanceATP * cellCount * dt;
    
    const lactateProduction = lactateRate * cellCount * dt;
    const pyruvateAccumulation = (pyruvateProduction - tcaRate - lactateRate) * cellCount * dt;
    const nadhProduction = (glycolysisRate * 2 + tcaRate * 4) * dt;
    const nadhConsumption = (lactateRate + tcaRate * 3) * dt;

    const newGlucose = glucose - glucoseConsumption + (glucoseConc - glucose) * 0.02 * dt;
    const newDissolvedOxygen = Math.max(0, dissolvedOxygen - oxygenConsumption + 
      (this.params.dissolvedOxygen - dissolvedOxygen) * 0.08 * dt);
    const newAtp = Math.max(0, Math.min(20, atp + atpProduction - atpConsumption));
    const newLactate = lactate + lactateProduction;
    const newPyruvate = Math.max(0, Math.min(10, pyruvate + pyruvateAccumulation));
    const newNADH = Math.max(0, Math.min(5, nadh + nadhProduction - nadhConsumption));

    const lactateInhibition = this.kinetics.calculateLactateInhibition(newLactate);
    const viability = Math.max(0.5, 1 - newLactate / 100);
    const actualGrowthRate = growthRate * viability;

    const newCellCount = Math.max(
      0.1, 
      Math.min(this.cellLineData.physiological.maximumCellDensity, 
        cellCount * (1 + actualGrowthRate * dt))
    );

    this.cultureTime += dt;

    const specificGrowthRate = actualGrowthRate / Math.max(0.1, newCellCount);

    this.state = {
      cellCount: newCellCount,
      glucose: Math.max(0, newGlucose),
      lactate: Math.max(0, newLactate),
      atp: newAtp,
      pyruvate: newPyruvate,
      nadh: newNADH,
      dissolvedOxygen: newDissolvedOxygen,
      growthRate: actualGrowthRate,
      specificGrowthRate,
      glycolysisFlux: glycolysisRate,
      tcaFlux: tcaRate,
      lactateFlux: lactateRate,
      specificGlucoseUptake: specificRates.specificGlucoseUptake,
      specificLactateProduction: specificRates.specificLactateProduction,
      pyruvateToTcaRatio: partitioning.toTca,
      pyruvateToLactateRatio: partitioning.toLactate,
      glucoseEffect,
      oxygenEffect,
      lactateInhibition,
      viability
    };

    if (this.cultureTime % 1 < dt) {
      this._takeSnapshot();
    }

    return this.getState();
  }

  _takeSnapshot() {
    this.snapshots.push({
      time: this.cultureTime,
      state: this.getState(),
      diagnostics: this.getDiagnostics()
    });
    
    if (this.snapshots.length > 1000) {
      this.snapshots.shift();
    }
  }

  getSnapshots() {
    return [...this.snapshots];
  }

  getGrowthCurve() {
    return this.snapshots.map(s => ({
      time: s.time,
      cellCount: s.state.cellCount,
      glucose: s.state.glucose,
      lactate: s.state.lactate,
      specificGrowthRate: s.state.specificGrowthRate
    }));
  }

  getMetabolicFluxes() {
    return {
      glycolysis: this.state.glycolysisFlux,
      tca: this.state.tcaFlux,
      lactate: this.state.lactateFlux,
      atpProduction: this.kinetics.calculateATPProduction(
        this.state.glycolysisFlux,
        this.state.tcaFlux
      ),
      partitioning: {
        toTca: this.state.pyruvateToTcaRatio,
        toLactate: this.state.pyruvateToLactateRatio
      }
    };
  }

  getInhibitionAnalysis() {
    return {
      glucoseEffect: this.state.glucoseEffect,
      oxygenEffect: this.state.oxygenEffect,
      lactateInhibition: this.state.lactateInhibition,
      viability: this.state.viability,
      totalInhibition: this.state.glucoseEffect * this.state.oxygenEffect * this.state.lactateInhibition
    };
  }

  getPhysiologicalState() {
    return {
      specificGrowthRate: this.state.specificGrowthRate,
      specificGlucoseUptake: this.state.specificGlucoseUptake,
      specificLactateProduction: this.state.specificLactateProduction,
      lactateYield: this.state.glycolysisFlux > 0 
        ? this.state.lactateFlux / (this.state.glycolysisFlux * 2) 
        : 0,
      glucoseToBiomassYield: this.state.specificGrowthRate > 0 
        ? this.state.specificGrowthRate / this.state.specificGlucoseUptake 
        : 0,
      tcaFraction: this.state.pyruvateToTcaRatio
    };
  }

  predictSteadyState(glucose, oxygen) {
    const tempState = { ...this.state };
    tempState.glucose = glucose;
    tempState.dissolvedOxygen = oxygen;
    tempState.lactate = 0;
    tempState.atp = 2;
    tempState.cellCount = 1;

    const steady = this.kinetics.calculatePhenotypicState(
      glucose, oxygen, 0, 2, 1
    );

    return {
      predictedGrowthRate: steady.growthRate,
      predictedLactateRate: steady.lactateRate,
      predictedTcaRate: steady.tcaRate,
      predictedSpecificGrowthRate: steady.specificRates.specificGrowthRate,
      partitioning: steady.partitioning
    };
  }

  optimizeParameters(targetGrowthRate) {
    const physio = this.cellLineData.physiological;
    const results = [];

    for (let glucose = 5; glucose <= 50; glucose += 5) {
      for (let oxygen = 10; oxygen <= 90; oxygen += 10) {
        const prediction = this.predictSteadyState(glucose, oxygen);
        const error = Math.abs(prediction.predictedGrowthRate - targetGrowthRate);
        results.push({ glucose, oxygen, prediction, error });
      }
    }

    results.sort((a, b) => a.error - b.error);
    return results.slice(0, 5);
  }

  reset() {
    this.state = this._getInitialState();
    this.cultureTime = 0;
    this.snapshots = [];
    return this.getState();
  }

  clone() {
    const clone = new MetabolismModel(this.cellLineId);
    clone.state = { ...this.state };
    clone.params = { ...this.params };
    clone.cultureTime = this.cultureTime;
    return clone;
  }
}

module.exports = MetabolismModel;
