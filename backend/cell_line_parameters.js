const fs = require('fs');
const path = require('path');

const DEFAULT_CELL_LINES = {
  CHO_K1: {
    id: 'CHO_K1',
    name: 'CHO-K1 中国仓鼠卵巢细胞',
    description: '标准CHO细胞株，适用于重组蛋白表达',
    kinetics: {
      Ks_glucose: 1.0,
      Ki_glucose: 40.0,
      Ks_oxygen: 5.0,
      Ki_lactate: 60.0,
      maxGlycolysisRate: 1.2,
      maxTcaRate: 0.8,
      maxLactateProductionRate: 1.5,
      maxGrowthRate: 0.035,
      Yxs: 0.5,
      maintenanceATP: 0.1,
      P_O: 2.5,
      lactateDehydrogenaseActivity: 1.0,
      pyruvateDehydrogenaseActivity: 1.0
    },
    physiological: {
      optimalGlucose: 25.0,
      optimalOxygen: 50.0,
      optimalTemperature: 37.0,
      optimalPH: 7.2,
      maximumCellDensity: 10.0,
      averageCellSize: 15.0,
      cellCycleTime: 24.0
    },
    inhibition: {
      lactateInhibitionThreshold: 30.0,
      lactateInhibitionK: 60.0,
      glucoseInhibitionK: 40.0,
      ammoniaInhibitionK: 10.0,
      osmoticPressureThreshold: 350.0
    },
    yields: {
      Y_atp_glucose_glycolysis: 2.0,
      Y_atp_glucose_tca: 30.0,
      Y_lactate_glucose: 1.8,
      Y_biomass_glucose: 0.5,
      Y_co2_glucose: 1.5,
      O2_per_glucose_tca: 6.0
    }
  },
  HEK293: {
    id: 'HEK293',
    name: 'HEK293 人胚肾细胞',
    description: '用于病毒载体和重组蛋白生产',
    kinetics: {
      Ks_glucose: 1.5,
      Ki_glucose: 50.0,
      Ks_oxygen: 8.0,
      Ki_lactate: 50.0,
      maxGlycolysisRate: 1.5,
      maxTcaRate: 0.6,
      maxLactateProductionRate: 2.0,
      maxGrowthRate: 0.04,
      Yxs: 0.4,
      maintenanceATP: 0.15,
      P_O: 2.0,
      lactateDehydrogenaseActivity: 1.3,
      pyruvateDehydrogenaseActivity: 0.8
    },
    physiological: {
      optimalGlucose: 20.0,
      optimalOxygen: 40.0,
      optimalTemperature: 37.0,
      optimalPH: 7.1,
      maximumCellDensity: 8.0,
      averageCellSize: 18.0,
      cellCycleTime: 20.0
    },
    inhibition: {
      lactateInhibitionThreshold: 25.0,
      lactateInhibitionK: 50.0,
      glucoseInhibitionK: 50.0,
      ammoniaInhibitionK: 8.0,
      osmoticPressureThreshold: 340.0
    },
    yields: {
      Y_atp_glucose_glycolysis: 2.0,
      Y_atp_glucose_tca: 28.0,
      Y_lactate_glucose: 2.0,
      Y_biomass_glucose: 0.4,
      Y_co2_glucose: 1.3,
      O2_per_glucose_tca: 6.0
    }
  },
  Hybridoma: {
    id: 'Hybridoma',
    name: '杂交瘤细胞',
    description: '用于单克隆抗体生产',
    kinetics: {
      Ks_glucose: 0.8,
      Ki_glucose: 35.0,
      Ks_oxygen: 4.0,
      Ki_lactate: 45.0,
      maxGlycolysisRate: 1.0,
      maxTcaRate: 0.9,
      maxLactateProductionRate: 1.2,
      maxGrowthRate: 0.03,
      Yxs: 0.55,
      maintenanceATP: 0.08,
      P_O: 2.8,
      lactateDehydrogenaseActivity: 0.9,
      pyruvateDehydrogenaseActivity: 1.1
    },
    physiological: {
      optimalGlucose: 30.0,
      optimalOxygen: 55.0,
      optimalTemperature: 36.5,
      optimalPH: 7.3,
      maximumCellDensity: 6.0,
      averageCellSize: 16.0,
      cellCycleTime: 28.0
    },
    inhibition: {
      lactateInhibitionThreshold: 20.0,
      lactateInhibitionK: 45.0,
      glucoseInhibitionK: 35.0,
      ammoniaInhibitionK: 6.0,
      osmoticPressureThreshold: 330.0
    },
    yields: {
      Y_atp_glucose_glycolysis: 2.0,
      Y_atp_glucose_tca: 32.0,
      Y_lactate_glucose: 1.5,
      Y_biomass_glucose: 0.55,
      Y_co2_glucose: 1.6,
      O2_per_glucose_tca: 6.0
    }
  }
};

class CellLineParameters {
  constructor() {
    this.cellLines = { ...DEFAULT_CELL_LINES };
    this.currentCellLineId = 'CHO_K1';
    this.customCellLinesPath = path.join(__dirname, 'cell_lines.json');
    this.loadCustomCellLines();
  }

  loadCustomCellLines() {
    try {
      if (fs.existsSync(this.customCellLinesPath)) {
        const customData = JSON.parse(fs.readFileSync(this.customCellLinesPath, 'utf8'));
        this.cellLines = { ...this.cellLines, ...customData };
      }
    } catch (error) {
      console.warn('无法加载自定义细胞株参数:', error.message);
    }
  }

  saveCustomCellLine(cellLine) {
    try {
      let customData = {};
      if (fs.existsSync(this.customCellLinesPath)) {
        customData = JSON.parse(fs.readFileSync(this.customCellLinesPath, 'utf8'));
      }
      customData[cellLine.id] = cellLine;
      fs.writeFileSync(this.customCellLinesPath, JSON.stringify(customData, null, 2));
      this.cellLines[cellLine.id] = cellLine;
      return true;
    } catch (error) {
      console.error('保存细胞株参数失败:', error.message);
      return false;
    }
  }

  getCellLine(cellLineId) {
    return this.cellLines[cellLineId] || this.cellLines[this.currentCellLineId];
  }

  setCurrentCellLine(cellLineId) {
    if (this.cellLines[cellLineId]) {
      this.currentCellLineId = cellLineId;
      return true;
    }
    return false;
  }

  getCurrentCellLine() {
    return this.getCellLine(this.currentCellLineId);
  }

  getAllCellLines() {
    return Object.values(this.cellLines).map(cl => ({
      id: cl.id,
      name: cl.name,
      description: cl.description
    }));
  }

  getKinetics(cellLineId) {
    return this.getCellLine(cellLineId).kinetics;
  }

  getPhysiological(cellLineId) {
    return this.getCellLine(cellLineId).physiological;
  }

  getInhibition(cellLineId) {
    return this.getCellLine(cellLineId).inhibition;
  }

  getYields(cellLineId) {
    return this.getCellLine(cellLineId).yields;
  }

  createCustomCellLine(baseLineId, newId, name, overrides) {
    const baseLine = this.getCellLine(baseLineId);
    if (!baseLine) return null;

    const newCellLine = JSON.parse(JSON.stringify(baseLine));
    newCellLine.id = newId;
    newCellLine.name = name;
    
    if (overrides.kinetics) {
      Object.assign(newCellLine.kinetics, overrides.kinetics);
    }
    if (overrides.physiological) {
      Object.assign(newCellLine.physiological, overrides.physiological);
    }
    if (overrides.inhibition) {
      Object.assign(newCellLine.inhibition, overrides.inhibition);
    }
    if (overrides.yields) {
      Object.assign(newCellLine.yields, overrides.yields);
    }

    return newCellLine;
  }

  validateParameters(params) {
    const errors = [];
    
    if (!params.kinetics) errors.push('缺少kinetics参数');
    if (!params.physiological) errors.push('缺少physiological参数');
    if (!params.inhibition) errors.push('缺少inhibition参数');
    if (!params.yields) errors.push('缺少yields参数');

    if (params.kinetics) {
      const requiredKinetics = ['Ks_glucose', 'Ki_glucose', 'Ks_oxygen', 'maxGrowthRate'];
      requiredKinetics.forEach(key => {
        if (!(key in params.kinetics)) {
          errors.push(`缺少kinetics.${key}`);
        }
      });
    }

    return errors;
  }
}

module.exports = CellLineParameters;
