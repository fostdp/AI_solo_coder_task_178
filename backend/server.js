const express = require('express');
const cors = require('cors');
const path = require('path');
const MetabolismModel = require('./metabolism');
const db = require('./database');
const CellLineParameters = require('./cell_line_parameters');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const cellLineManager = new CellLineParameters();
let model = new MetabolismModel();
let currentParamsId = null;
let simulationInterval = null;
let isRunning = false;
let currentExperimentId = null;

app.get('/api/state', (req, res) => {
  res.json(model.getState());
});

app.get('/api/diagnostics', (req, res) => {
  res.json(model.getDiagnostics());
});

app.get('/api/physiological', (req, res) => {
  res.json(model.getPhysiologicalState());
});

app.get('/api/fluxes', (req, res) => {
  res.json(model.getMetabolicFluxes());
});

app.get('/api/inhibition', (req, res) => {
  res.json(model.getInhibitionAnalysis());
});

app.get('/api/growth-curve', (req, res) => {
  const experimentId = req.query.experimentId ? parseInt(req.query.experimentId) : null;
  const curve = db.getGrowthCurveData(experimentId);
  res.json(curve);
});

app.get('/api/physiological-parameters', (req, res) => {
  const experimentId = req.query.experimentId ? parseInt(req.query.experimentId) : null;
  const params = db.getPhysiologicalParameters(experimentId);
  res.json(params);
});

app.post('/api/params', (req, res) => {
  const { glucose, dissolvedOxygen } = req.body;
  model.setParams(glucose, dissolvedOxygen);
  currentParamsId = db.saveParams(glucose, dissolvedOxygen, model.cellLineId);
  res.json({ success: true, paramsId: currentParamsId });
});

app.post('/api/predict-steady-state', (req, res) => {
  const { glucose, oxygen } = req.body;
  const prediction = model.predictSteadyState(glucose, oxygen);
  res.json(prediction);
});

app.post('/api/optimize-parameters', (req, res) => {
  const { targetGrowthRate } = req.body;
  const optimizations = model.optimizeParameters(targetGrowthRate);
  res.json(optimizations);
});

app.get('/api/cell-lines', (req, res) => {
  const cellLines = model.getAvailableCellLines();
  res.json(cellLines);
});

app.get('/api/current-cell-line', (req, res) => {
  res.json(model.getCellLineInfo());
});

app.post('/api/set-cell-line', (req, res) => {
  const { cellLineId } = req.body;
  const success = model.setCellLine(cellLineId);
  if (success) {
    res.json({ success: true, cellLine: model.getCellLineInfo() });
  } else {
    res.status(400).json({ success: false, error: 'Cell line not found' });
  }
});

app.post('/api/create-cell-line', (req, res) => {
  const { baseLineId, newId, name, overrides } = req.body;
  const newCellLine = cellLineManager.createCustomCellLine(baseLineId, newId, name, overrides);
  if (newCellLine) {
    const validationErrors = cellLineManager.validateParameters(newCellLine);
    if (validationErrors.length === 0) {
      cellLineManager.saveCustomCellLine(newCellLine);
      db.saveCellLineRecord(newCellLine);
      res.json({ success: true, cellLine: newCellLine });
    } else {
      res.status(400).json({ success: false, errors: validationErrors });
    }
  } else {
    res.status(400).json({ success: false, error: 'Failed to create cell line' });
  }
});

app.get('/api/cell-line-records', (req, res) => {
  const records = db.getCellLineRecords();
  res.json(records);
});

app.get('/api/cell-line-kinetics/:cellLineId', (req, res) => {
  const { cellLineId } = req.params;
  const kinetics = cellLineManager.getKinetics(cellLineId);
  const physiological = cellLineManager.getPhysiological(cellLineId);
  const inhibition = cellLineManager.getInhibition(cellLineId);
  const yields = cellLineManager.getYields(cellLineId);
  res.json({ kinetics, physiological, inhibition, yields });
});

app.post('/api/experiments', (req, res) => {
  const { name, description, cellLineId } = req.body;
  const { id, experiment } = db.createExperiment(name, description, cellLineId || model.cellLineId);
  res.json({ success: true, experimentId: id, experiment });
});

app.get('/api/experiments', (req, res) => {
  const experiments = db.getExperiments();
  res.json(experiments);
});

app.get('/api/experiments/:id', (req, res) => {
  const experiment = db.getExperimentById(parseInt(req.params.id));
  if (experiment) {
    res.json(experiment);
  } else {
    res.status(404).json({ error: 'Experiment not found' });
  }
});

app.post('/api/experiments/:id/start', (req, res) => {
  const experimentId = parseInt(req.params.id);
  currentExperimentId = experimentId;
  db.updateExperiment(experimentId, { status: 'running' });
  res.json({ success: true, message: 'Experiment started' });
});

app.post('/api/experiments/:id/stop', (req, res) => {
  const experimentId = parseInt(req.params.id);
  if (currentExperimentId === experimentId) {
    currentExperimentId = null;
  }
  db.updateExperiment(experimentId, { 
    status: 'completed', 
    end_time: new Date().toISOString() 
  });
  res.json({ success: true, message: 'Experiment stopped' });
});

app.get('/api/experiments/:id/export', (req, res) => {
  const format = req.query.format || 'json';
  const data = db.exportExperimentData(parseInt(req.params.id), format);
  if (data) {
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="experiment_${req.params.id}.csv"`);
    }
    res.send(data);
  } else {
    res.status(404).json({ error: 'Experiment not found' });
  }
});

app.post('/api/start', (req, res) => {
  if (!isRunning) {
    isRunning = true;
    simulationInterval = setInterval(() => {
      const state = model.step(0.1);
      if (currentParamsId) {
        const snapshotId = db.saveSnapshot(currentParamsId, state, model.cellLineId);
        if (currentExperimentId && snapshotId) {
          db.addSnapshotToExperiment(currentExperimentId, snapshotId);
        }
      }
    }, 100);
  }
  res.json({ running: true });
});

app.post('/api/stop', (req, res) => {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  isRunning = false;
  res.json({ running: false });
});

app.post('/api/reset', (req, res) => {
  const state = model.reset();
  res.json(state);
});

app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const cellLineId = req.query.cellLineId || null;
  const history = db.getHistory(limit, cellLineId);
  res.json(history);
});

app.get('/api/latest-snapshot', (req, res) => {
  const cellLineId = req.query.cellLineId || null;
  const snapshot = db.getLatestSnapshot(cellLineId);
  res.json(snapshot || {});
});

app.get('/api/sensitivity-analysis', (req, res) => {
  const { parameter, minFactor = 0.5, maxFactor = 2.0, steps = 10 } = req.query;
  const range = [];
  const stepSize = (maxFactor - minFactor) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    range.push(minFactor + i * stepSize);
  }
  
  const state = model.getState();
  const conditions = {
    glucose: state.glucose,
    oxygen: state.dissolvedOxygen,
    lactate: state.lactate,
    atp: state.atp,
    cellCount: state.cellCount
  };
  
  const results = model.kinetics.sensitivityAnalysis(parameter, range, conditions);
  res.json(results);
});

app.get('/api/mca', (req, res) => {
  const state = model.getState();
  const conditions = {
    glucose: state.glucose,
    oxygen: state.dissolvedOxygen,
    lactate: state.lactate,
    atp: state.atp,
    cellCount: state.cellCount
  };
  
  const mcaResults = model.kinetics.getMetabolicControlAnalysis(conditions);
  res.json(mcaResults);
});

app.get('/api/feeding-strategy', (req, res) => {
  const state = model.getState();
  const cellLine = model.cellLineData;
  
  const currentGlucose = state.glucose;
  const optimalGlucose = cellLine.physiological.optimalGlucose;
  const glucoseUptake = state.specificGlucoseUptake * state.cellCount;
  const lactateThreshold = cellLine.inhibition.lactateInhibitionThreshold;
  
  let status = 'optimal';
  let feedingRate = 0;
  let recommendation = '';
  let lactateRisk = 'low';
  
  if (currentGlucose < optimalGlucose * 0.7) {
    status = 'feed';
    feedingRate = (optimalGlucose - currentGlucose) * 0.1 + glucoseUptake;
    recommendation = `葡萄糖浓度偏低(${currentGlucose.toFixed(1)}mM)，建议以${feedingRate.toFixed(2)}mM/h速率补加葡萄糖。维持溶氧在${cellLine.physiological.optimalOxygen}%左右，观察乳酸积累速率。`;
  } else if (currentGlucose > optimalGlucose * 1.3) {
    status = 'abnormal';
    feedingRate = 0;
    recommendation = `葡萄糖浓度过高(${currentGlucose.toFixed(1)}mM)，可能引起底物抑制。建议降低补糖速率或增加稀释速率，待浓度回落至25-30mM范围后恢复正常补料。`;
  } else if (state.lactate > lactateThreshold * 0.8) {
    status = 'abnormal';
    feedingRate = Math.max(0, glucoseUptake * 0.7);
    recommendation = `乳酸积累较高(${state.lactate.toFixed(1)}mM)，建议降低补糖速率30%，提高溶氧至${Math.min(80, cellLine.physiological.optimalOxygen + 15)}%以促进有氧代谢，减少乳酸生成。`;
  } else if (state.specificGrowthRate < cellLine.kinetics.maxGrowthRate * 0.3) {
    status = 'feed';
    feedingRate = glucoseUptake * 1.2;
    recommendation = `生长速率偏低(${state.specificGrowthRate.toFixed(4)}h⁻¹)，建议微调补糖速率至${feedingRate.toFixed(2)}mM/h，同时检查溶氧和温度是否在最优范围。`;
  } else {
    status = 'optimal';
    feedingRate = glucoseUptake;
    recommendation = `当前培养状态良好，葡萄糖浓度(${currentGlucose.toFixed(1)}mM)和溶氧(${state.dissolvedOxygen.toFixed(0)}%)均在最优范围。建议维持当前补料速率${feedingRate.toFixed(2)}mM/h，持续监测比生长速率和乳酸积累。`;
  }
  
  if (state.lactate > lactateThreshold * 0.6) {
    lactateRisk = 'medium';
  }
  if (state.lactate > lactateThreshold * 0.9) {
    lactateRisk = 'high';
  }
  
  const predictedGrowthRate = state.specificGrowthRate * (status === 'feed' ? 1.2 : status === 'abnormal' ? 0.8 : 1.0);
  
  res.json({
    status,
    currentGlucose,
    optimalGlucose,
    feedingRate,
    predictedGrowthRate,
    lactateRisk,
    recommendation,
    details: {
      currentUptakeRate: glucoseUptake,
      lactateLevel: state.lactate,
      lactateThreshold,
      specificGrowthRate: state.specificGrowthRate,
      maxGrowthRate: cellLine.kinetics.maxGrowthRate
    }
  });
});

app.get('/api/flux-analysis', (req, res) => {
  const state = model.getState();
  const diagnostics = model.getDiagnostics();
  
  const fluxes = {
    glycolysis: {
      rate: state.glycolysisFlux,
      percentage: 100,
      description: '糖酵解途径 - 葡萄糖分解为丙酮酸'
    },
    tca: {
      rate: state.tcaFlux,
      percentage: state.glycolysisFlux > 0 ? (state.tcaFlux / (state.glycolysisFlux * 2) * 100) : 0,
      description: 'TCA循环 - 有氧氧化高效产ATP'
    },
    lactate: {
      rate: state.lactateFlux,
      percentage: state.glycolysisFlux > 0 ? (state.lactateFlux / (state.glycolysisFlux * 2) * 100) : 0,
      description: '乳酸生成 - 无氧代谢产物'
    }
  };
  
  const carbonEfficiency = diagnostics.carbonBalance.closure;
  const energyEfficiency = diagnostics.energeticYield.growthYield;
  const redoxBalance = diagnostics.redoxBalance.redoxState;
  
  let overallStatus = 'balanced';
  if (carbonEfficiency < 0.8 || carbonEfficiency > 1.2 || redoxBalance < 0.7 || redoxBalance > 1.3) {
    overallStatus = 'imbalanced';
  }
  
  res.json({
    fluxes,
    diagnostics,
    overallStatus,
    efficiency: {
      carbon: carbonEfficiency,
      energy: energyEfficiency,
      redox: redoxBalance
    },
    recommendations: generateFluxRecommendations(fluxes, diagnostics)
  });
});

function generateFluxRecommendations(fluxes, diagnostics) {
  const recommendations = [];
  
  if (fluxes.lactate.percentage > 40) {
    recommendations.push('乳酸生成比例过高，建议提高溶氧水平以促进丙酮酸进入TCA循环');
  }
  
  if (fluxes.tca.percentage < 30 && diagnostics.redoxBalance.redoxState > 1.2) {
    recommendations.push('TCA通量偏低，NADH积累，可能存在氧限制');
  }
  
  if (diagnostics.carbonBalance.closure < 0.85) {
    recommendations.push('碳平衡闭合度偏低，部分中间代谢物可能未计入');
  }
  
  if (diagnostics.energeticYield.growthYield < 0.3) {
    recommendations.push('能量利用效率偏低，较多ATP用于维持而非生长');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('代谢网络状态良好，各途径通量分配合理');
  }
  
  return recommendations;
}

app.listen(PORT, () => {
  console.log(`🧬 Bioreactor server running at http://localhost:${PORT}`);
  console.log(`   Current cell line: ${model.cellLineId}`);
  console.log(`   Available cell lines: ${model.getAvailableCellLines().map(c => c.id).join(', ')}`);
  console.log(`   Frontend dev server: http://localhost:5173`);
  currentParamsId = db.saveParams(25.0, 50.0, model.cellLineId);
});
