const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'bioreactor-data.json');
const experimentsPath = path.join(__dirname, 'experiments');

if (!fs.existsSync(experimentsPath)) {
  fs.mkdirSync(experimentsPath, { recursive: true });
}

function initDB() {
  if (!fs.existsSync(dbPath)) {
    const initialData = {
      culture_params: [],
      metabolism_snapshots: [],
      cell_line_records: [],
      experiments: []
    };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
  }
}

function readDB() {
  initDB();
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function saveParams(glucose, dissolvedOxygen, cellLineId = 'CHO_K1') {
  const db = readDB();
  const id = db.culture_params.length + 1;
  db.culture_params.push({
    id,
    glucose,
    dissolved_oxygen: dissolvedOxygen,
    cell_line_id: cellLineId,
    timestamp: new Date().toISOString()
  });
  writeDB(db);
  return id;
}

function saveSnapshot(paramsId, data, cellLineId = 'CHO_K1') {
  const db = readDB();
  const id = db.metabolism_snapshots.length + 1;
  db.metabolism_snapshots.push({
    id,
    params_id: paramsId,
    cell_line_id: cellLineId,
    cell_count: data.cellCount,
    glucose: data.glucose,
    lactate: data.lactate,
    atp: data.atp,
    pyruvate: data.pyruvate,
    nadh: data.nadh,
    dissolved_oxygen: data.dissolvedOxygen,
    growth_rate: data.growthRate,
    specific_growth_rate: data.specificGrowthRate,
    glycolysis_flux: data.glycolysisFlux,
    tca_flux: data.tcaFlux,
    lactate_flux: data.lactateFlux,
    specific_glucose_uptake: data.specificGlucoseUptake,
    specific_lactate_production: data.specificLactateProduction,
    pyruvate_to_tca_ratio: data.pyruvateToTcaRatio,
    pyruvate_to_lactate_ratio: data.pyruvateToLactateRatio,
    glucose_effect: data.glucoseEffect,
    oxygen_effect: data.oxygenEffect,
    lactate_inhibition: data.lactateInhibition,
    viability: data.viability,
    timestamp: new Date().toISOString()
  });
  writeDB(db);
  return id;
}

function saveCellLineRecord(cellLineData) {
  const db = readDB();
  const id = db.cell_line_records.length + 1;
  db.cell_line_records.push({
    id,
    cell_line_id: cellLineData.id,
    name: cellLineData.name,
    kinetics: cellLineData.kinetics,
    physiological: cellLineData.physiological,
    inhibition: cellLineData.inhibition,
    yields: cellLineData.yields,
    created_at: new Date().toISOString()
  });
  writeDB(db);
  return id;
}

function getCellLineRecords() {
  const db = readDB();
  return db.cell_line_records;
}

function createExperiment(name, description, cellLineId) {
  const db = readDB();
  const id = db.experiments.length + 1;
  const experiment = {
    id,
    name,
    description,
    cell_line_id: cellLineId,
    status: 'running',
    start_time: new Date().toISOString(),
    end_time: null,
    snapshot_ids: [],
    parameters: {}
  };
  db.experiments.push(experiment);
  writeDB(db);
  return { id, experiment };
}

function updateExperiment(experimentId, updates) {
  const db = readDB();
  const idx = db.experiments.findIndex(e => e.id === experimentId);
  if (idx >= 0) {
    db.experiments[idx] = { ...db.experiments[idx], ...updates };
    writeDB(db);
    return db.experiments[idx];
  }
  return null;
}

function addSnapshotToExperiment(experimentId, snapshotId) {
  const db = readDB();
  const experiment = db.experiments.find(e => e.id === experimentId);
  if (experiment) {
    experiment.snapshot_ids.push(snapshotId);
    writeDB(db);
    return true;
  }
  return false;
}

function getExperiments() {
  const db = readDB();
  return db.experiments;
}

function getExperimentById(experimentId) {
  const db = readDB();
  const experiment = db.experiments.find(e => e.id === experimentId);
  if (experiment) {
    const snapshots = db.metabolism_snapshots.filter(s => 
      experiment.snapshot_ids.includes(s.id)
    );
    return { ...experiment, snapshots };
  }
  return null;
}

function getHistory(limit = 50, cellLineId = null) {
  const db = readDB();
  let snapshots = db.metabolism_snapshots;
  
  if (cellLineId) {
    snapshots = snapshots.filter(s => s.cell_line_id === cellLineId);
  }
  
  snapshots = snapshots
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
  
  return snapshots.map(s => {
    const param = db.culture_params.find(p => p.id === s.params_id) || {};
    return {
      ...s,
      param_glucose: param.glucose,
      dissolved_oxygen: param.dissolved_oxygen
    };
  });
}

function getLatestSnapshot(cellLineId = null) {
  const history = getHistory(1, cellLineId);
  return history[0] || null;
}

function getGrowthCurveData(experimentId = null, limit = 100) {
  if (experimentId) {
    const experiment = getExperimentById(experimentId);
    if (experiment) {
      return experiment.snapshots.map(s => ({
        time: s.timestamp,
        cell_count: s.cell_count,
        glucose: s.glucose,
        lactate: s.lactate,
        specific_growth_rate: s.specific_growth_rate
      }));
    }
    return [];
  }
  
  const history = getHistory(limit);
  return history.map(s => ({
    time: s.timestamp,
    cell_count: s.cell_count,
    glucose: s.glucose,
    lactate: s.lactate,
    specific_growth_rate: s.specific_growth_rate
  }));
}

function getPhysiologicalParameters(experimentId = null) {
  const data = getGrowthCurveData(experimentId, 100);
  if (data.length < 2) return null;

  let totalBiomass = 0;
  let totalGlucoseConsumed = 0;
  let totalLactateProduced = 0;

  for (let i = 1; i < data.length; i++) {
    const deltaBiomass = data[i].cell_count - data[i-1].cell_count;
    const deltaGlucose = data[i-1].glucose - data[i].glucose;
    const deltaLactate = data[i].lactate - data[i-1].lactate;

    if (deltaBiomass > 0) totalBiomass += deltaBiomass;
    if (deltaGlucose > 0) totalGlucoseConsumed += deltaGlucose;
    if (deltaLactate > 0) totalLactateProduced += deltaLactate;
  }

  const maxGrowthRate = Math.max(...data.map(d => d.specific_growth_rate));
  const avgGrowthRate = data.reduce((sum, d) => sum + d.specific_growth_rate, 0) / data.length;

  return {
    maxSpecificGrowthRate: maxGrowthRate,
    avgSpecificGrowthRate: avgGrowthRate,
    yieldBiomassGlucose: totalGlucoseConsumed > 0 ? totalBiomass / totalGlucoseConsumed : 0,
    yieldLactateGlucose: totalGlucoseConsumed > 0 ? totalLactateProduced / totalGlucoseConsumed : 0,
    specificGlucoseUptake: totalGlucoseConsumed > 0 ? totalGlucoseConsumed / (data.length * 0.1) : 0,
    specificLactateProduction: totalLactateProduced > 0 ? totalLactateProduced / (data.length * 0.1) : 0,
    dataPoints: data.length
  };
}

function exportExperimentData(experimentId, format = 'json') {
  const experiment = getExperimentById(experimentId);
  if (!experiment) return null;

  const physioParams = getPhysiologicalParameters(experimentId);

  const exportData = {
    experiment: {
      id: experiment.id,
      name: experiment.name,
      description: experiment.description,
      cell_line_id: experiment.cell_line_id,
      start_time: experiment.start_time,
      end_time: experiment.end_time,
      status: experiment.status
    },
    physiologicalParameters: physioParams,
    snapshots: experiment.snapshots
  };

  if (format === 'csv') {
    const headers = Object.keys(experiment.snapshots[0] || {}).join(',');
    const rows = experiment.snapshots.map(s => Object.values(s).join(','));
    return [headers, ...rows].join('\n');
  }

  return JSON.stringify(exportData, null, 2);
}

module.exports = {
  saveParams,
  saveSnapshot,
  saveCellLineRecord,
  getCellLineRecords,
  createExperiment,
  updateExperiment,
  addSnapshotToExperiment,
  getExperiments,
  getExperimentById,
  getHistory,
  getLatestSnapshot,
  getGrowthCurveData,
  getPhysiologicalParameters,
  exportExperimentData
};
