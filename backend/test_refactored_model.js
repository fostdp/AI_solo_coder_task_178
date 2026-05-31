const MetabolismModel = require('./metabolism');
const KineticsFramework = require('./kinetics_framework');
const CellLineParameters = require('./cell_line_parameters');

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.failedDetails = [];
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('='.repeat(70));
    console.log('🧪 重构后代谢模型 - 统一动力学框架测试套件');
    console.log('='.repeat(70));
    console.log();

    for (const test of this.tests) {
      console.log(`🔍 测试: ${test.name}`);
      try {
        const result = await test.fn();
        if (result.passed) {
          console.log(`   ✅ PASS: ${result.message}`);
          this.passed++;
        } else {
          console.log(`   ❌ FAIL: ${result.message}`);
          if (result.details) {
            console.log(`   📋 详情:`);
            for (const [key, value] of Object.entries(result.details)) {
              console.log(`      - ${key}: ${value}`);
            }
          }
          this.failed++;
          this.failedDetails.push({ name: test.name, ...result });
        }
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        this.failed++;
        this.failedDetails.push({ name: test.name, message: error.message });
      }
      console.log();
    }

    console.log('='.repeat(70));
    console.log(`📊 测试结果: ${this.passed} 通过, ${this.failed} 失败, ${this.tests.length} 总计`);
    console.log('='.repeat(70));

    if (this.failed > 0) {
      console.log();
      console.log('❌ 失败用例明细:');
      console.log('-'.repeat(50));
      this.failedDetails.forEach((fail, idx) => {
        console.log(`${idx + 1}. ${fail.name}`);
        console.log(`   原因: ${fail.message}`);
        if (fail.details) {
          for (const [key, value] of Object.entries(fail.details)) {
            console.log(`   ${key}: ${value}`);
          }
        }
        console.log();
      });
    }

    return this.failed === 0;
  }
}

const runner = new TestRunner();

runner.test('1. 细胞株参数管理 - 默认细胞株CHO_K1存在', async () => {
  const manager = new CellLineParameters();
  const cellLine = manager.getCurrentCellLine();
  const passed = cellLine && cellLine.id === 'CHO_K1';
  return {
    passed,
    message: passed ? `默认细胞株: ${cellLine.name}` : '默认细胞株不存在',
    details: { cellLineId: cellLine?.id, cellLineName: cellLine?.name }
  };
});

runner.test('2. 细胞株参数管理 - 多细胞株支持', async () => {
  const manager = new CellLineParameters();
  const cellLines = manager.getAllCellLines();
  const passed = cellLines.length >= 3 && 
    cellLines.some(c => c.id === 'CHO_K1') &&
    cellLines.some(c => c.id === 'HEK293') &&
    cellLines.some(c => c.id === 'Hybridoma');
  return {
    passed,
    message: passed ? `支持${cellLines.length}种细胞株` : `细胞株数量不足，仅${cellLines.length}种`,
    details: { availableCellLines: cellLines.map(c => c.id).join(', ') }
  };
});

runner.test('3. 细胞株参数管理 - 动力学参数完整', async () => {
  const manager = new CellLineParameters();
  const kinetics = manager.getKinetics('CHO_K1');
  const requiredFields = ['Ks_glucose', 'Ki_glucose', 'Ks_oxygen', 'maxGrowthRate'];
  const missingFields = requiredFields.filter(f => !(f in kinetics));
  const passed = missingFields.length === 0;
  return {
    passed,
    message: passed ? '所有必要动力学参数存在' : `缺少参数: ${missingFields.join(', ')}`,
    details: { kineticsKeys: Object.keys(kinetics).join(', ') }
  };
});

runner.test('4. 动力学框架 - Michaelis-Menten方程正确性', async () => {
  const manager = new CellLineParameters();
  const cellLine = manager.getCellLine('CHO_K1');
  const kinetics = new KineticsFramework(cellLine.kinetics, cellLine.inhibition, cellLine.yields);
  
  const v = kinetics.michaelisMenten(1.0, 1.0);
  const passed = Math.abs(v - 0.5) < 0.001;
  return {
    passed,
    message: passed ? `S=Km时Vmax/2=${v.toFixed(4)}` : `Michaelis-Menten计算错误: ${v}`,
    details: { 'S=Km=1, 预期V=0.5': v.toFixed(6) }
  };
});

runner.test('5. 动力学框架 - Haldane底物抑制方程', async () => {
  const manager = new CellLineParameters();
  const cellLine = manager.getCellLine('CHO_K1');
  const kinetics = new KineticsFramework(cellLine.kinetics, cellLine.inhibition, cellLine.yields);
  
  const v25 = kinetics.haldaneEquation(25, 1.0, 40.0);
  const v50 = kinetics.haldaneEquation(50, 1.0, 40.0);
  const v80 = kinetics.haldaneEquation(80, 1.0, 40.0);
  
  const passed = v25 > v50 && v50 > v80;
  return {
    passed,
    message: passed ? '底物抑制随浓度增加而增强' : '底物抑制趋势不正确',
    details: {
      '25mM': v25.toFixed(4),
      '50mM': v50.toFixed(4),
      '80mM': v80.toFixed(4),
      '25→50变化': ((v25 - v50) / v25 * 100).toFixed(1) + '%',
      '50→80变化': ((v50 - v80) / v50 * 100).toFixed(1) + '%'
    }
  };
});

runner.test('6. 动力学框架 - 丙酮酸分配的氧依赖性', async () => {
  const manager = new CellLineParameters();
  const cellLine = manager.getCellLine('CHO_K1');
  const kinetics = new KineticsFramework(cellLine.kinetics, cellLine.inhibition, cellLine.yields);
  
  const lowOxygen = kinetics.calculatePyruvatePartitioning(5);
  const highOxygen = kinetics.calculatePyruvatePartitioning(50);
  
  const passed = lowOxygen.toLactate > highOxygen.toLactate && 
                 lowOxygen.toTca < highOxygen.toTca;
  return {
    passed,
    message: passed ? '丙酮酸分配正确响应氧浓度' : '丙酮酸分配未正确响应氧浓度',
    details: {
      '5%DO→乳酸': (lowOxygen.toLactate * 100).toFixed(1) + '%',
      '5%DO→TCA': (lowOxygen.toTca * 100).toFixed(1) + '%',
      '50%DO→乳酸': (highOxygen.toLactate * 100).toFixed(1) + '%',
      '50%DO→TCA': (highOxygen.toTca * 100).toFixed(1) + '%'
    }
  };
});

runner.test('7. 动力学框架 - 表型状态计算完整性', async () => {
  const manager = new CellLineParameters();
  const cellLine = manager.getCellLine('CHO_K1');
  const kinetics = new KineticsFramework(cellLine.kinetics, cellLine.inhibition, cellLine.yields);
  
  const state = kinetics.calculatePhenotypicState(25, 50, 0, 2, 1);
  const requiredFields = ['glycolysisRate', 'tcaRate', 'lactateRate', 'growthRate', 'specificRates'];
  const missingFields = requiredFields.filter(f => !(f in state));
  const passed = missingFields.length === 0 && state.specificRates.specificGrowthRate !== undefined;
  return {
    passed,
    message: passed ? '表型状态包含所有必要字段' : `缺少字段: ${missingFields.join(', ')}`,
    details: { 
      stateKeys: Object.keys(state).join(', '),
      specificRatesKeys: Object.keys(state.specificRates).join(', ')
    }
  };
});

runner.test('8. 代谢模型 - 溶氧响应: 低氧时乳酸比生成速率更高', async () => {
  const model = new MetabolismModel();
  
  model.reset();
  model.setParams(25, 5);
  for (let i = 0; i < 100; i++) model.step(0.1);
  const lowOxygenState = model.getState();
  
  model.reset();
  model.setParams(25, 50);
  for (let i = 0; i < 100; i++) model.step(0.1);
  const highOxygenState = model.getState();

  const passed = lowOxygenState.specificLactateProduction > highOxygenState.specificLactateProduction * 1.2;
  
  return {
    passed,
    message: passed 
      ? `低氧乳酸生成(${lowOxygenState.specificLactateProduction.toFixed(4)}) > 高氧(${highOxygenState.specificLactateProduction.toFixed(4)})`
      : `低氧乳酸生成未显著高于高氧`,
    details: {
      '5%DO时qLac': lowOxygenState.specificLactateProduction.toFixed(6),
      '50%DO时qLac': highOxygenState.specificLactateProduction.toFixed(6),
      '倍数': (lowOxygenState.specificLactateProduction / highOxygenState.specificLactateProduction).toFixed(2) + 'x',
      '5%DO时乳酸通量': lowOxygenState.lactateFlux.toFixed(4),
      '50%DO时乳酸通量': highOxygenState.lactateFlux.toFixed(4)
    }
  };
});

runner.test('9. 代谢模型 - 溶氧响应: 乳酸比生成速率单调下降', async () => {
  const model = new MetabolismModel();
  const results = [];
  
  for (let oxygen = 5; oxygen <= 50; oxygen += 5) {
    model.reset();
    model.setParams(25, oxygen);
    for (let i = 0; i < 100; i++) model.step(0.1);
    results.push({
      oxygen,
      lactateRate: model.getState().specificLactateProduction
    });
  }
  
  let decreasing = true;
  for (let i = 1; i < results.length; i++) {
    if (results[i].lactateRate > results[i-1].lactateRate) {
      decreasing = false;
      break;
    }
  }

  return {
    passed: decreasing,
    message: decreasing
      ? '乳酸比生成速率随溶氧增加单调下降'
      : '乳酸比生成速率未单调下降',
    details: Object.fromEntries(
      results.map(r => [`DO=${r.oxygen}%`, `qLac=${r.lactateRate.toFixed(4)}`])
    )
  };
});

runner.test('10. 代谢模型 - 底物抑制: 50mM葡萄糖比生长速率低于25mM', async () => {
  const model = new MetabolismModel();
  
  model.reset();
  model.setParams(25, 50);
  for (let i = 0; i < 100; i++) model.step(0.1);
  const state25 = model.getState();
  
  model.reset();
  model.setParams(50, 50);
  for (let i = 0; i < 100; i++) model.step(0.1);
  const state50 = model.getState();

  const passed = state25.specificGrowthRate > state50.specificGrowthRate;

  return {
    passed,
    message: passed
      ? `25mMμ(${state25.specificGrowthRate.toFixed(5)}) > 50mM(${state50.specificGrowthRate.toFixed(5)})`
      : `50mM未出现生长抑制`,
    details: {
      '25mM时μ': state25.specificGrowthRate.toFixed(6),
      '50mM时μ': state50.specificGrowthRate.toFixed(6),
      '抑制比例': ((state25.specificGrowthRate - state50.specificGrowthRate) / state25.specificGrowthRate * 100).toFixed(1) + '%',
      '25mM时葡萄糖效应': state25.glucoseEffect.toFixed(4),
      '50mM时葡萄糖效应': state50.glucoseEffect.toFixed(4)
    }
  };
});

runner.test('11. 代谢模型 - 底物抑制: 10-50mM出现下降趋势', async () => {
  const model = new MetabolismModel();
  const results = [];
  
  for (let glucose = 10; glucose <= 50; glucose += 10) {
    model.reset();
    model.setParams(glucose, 50);
    for (let i = 0; i < 100; i++) model.step(0.1);
    results.push({
      glucose,
      specificGrowthRate: model.getState().specificGrowthRate
    });
  }
  
  let decreasing = true;
  for (let i = 1; i < results.length; i++) {
    if (results[i].specificGrowthRate >= results[i-1].specificGrowthRate) {
      decreasing = false;
      break;
    }
  }

  const totalDrop = ((results[0].specificGrowthRate - results[results.length-1].specificGrowthRate) / results[0].specificGrowthRate) * 100;
  const passed = decreasing && totalDrop > 5;

  return {
    passed,
    message: passed
      ? `比生长速率从10mM到50mM单调下降${totalDrop.toFixed(1)}%`
      : '比生长速率未出现下降趋势',
    details: {
      ...Object.fromEntries(
        results.map(r => [`Glc=${r.glucose}mM`, `μ=${r.specificGrowthRate.toFixed(5)}`])
      ),
      '总下降比例': totalDrop.toFixed(1) + '%'
    }
  };
});

runner.test('12. 代谢模型 - 生理参数: specificGrowthRate字段存在且为正', async () => {
  const model = new MetabolismModel();
  model.setParams(25, 50);
  for (let i = 0; i < 50; i++) model.step(0.1);
  const state = model.getState();

  const passed = 'specificGrowthRate' in state && state.specificGrowthRate > 0;

  return {
    passed,
    message: passed
      ? `specificGrowthRate存在且为正: ${state.specificGrowthRate.toFixed(6)} h⁻¹`
      : `specificGrowthRate不存在或非正`,
    details: {
      'specificGrowthRate': state.specificGrowthRate?.toFixed(8) || 'MISSING',
      '字段存在': 'specificGrowthRate' in state
    }
  };
});

runner.test('13. 代谢模型 - 生理参数: 所有定量参数完整', async () => {
  const model = new MetabolismModel();
  model.setParams(25, 50);
  for (let i = 0; i < 50; i++) model.step(0.1);
  const state = model.getState();

  const requiredFields = [
    'specificGrowthRate',
    'specificGlucoseUptake',
    'specificLactateProduction',
    'pyruvate',
    'nadh',
    'lactateFlux',
    'pyruvateToTcaRatio',
    'pyruvateToLactateRatio',
    'glucoseEffect',
    'oxygenEffect',
    'lactateInhibition',
    'viability'
  ];

  const missingFields = requiredFields.filter(f => !(f in state));
  const passed = missingFields.length === 0;

  return {
    passed,
    message: passed
      ? `所有${requiredFields.length}个定量生理参数存在`
      : `缺少${missingFields.length}个参数: ${missingFields.join(', ')}`,
    details: Object.fromEntries(
      requiredFields.map(f => [f, f in state ? state[f]?.toFixed(4) || state[f] : 'MISSING'])
    )
  };
});

runner.test('14. 代谢模型 - 生理参数: 比生长速率计算正确', async () => {
  const model = new MetabolismModel();
  model.setParams(25, 50);
  for (let i = 0; i < 50; i++) model.step(0.1);
  const state = model.getState();

  const expectedMu = state.growthRate / state.cellCount;
  const passed = Math.abs(state.specificGrowthRate - expectedMu) < 0.0001;

  return {
    passed,
    message: passed
      ? '比生长速率 = 生长速率 / 细胞计数'
      : '比生长速率计算不一致',
    details: {
      'specificGrowthRate': state.specificGrowthRate.toFixed(8),
      'growthRate/cellCount': expectedMu.toFixed(8),
      '差值': Math.abs(state.specificGrowthRate - expectedMu).toFixed(10)
    }
  };
});

runner.test('15. 代谢模型 - 多细胞株: 不同细胞株动力学参数不同', async () => {
  const model1 = new MetabolismModel('CHO_K1');
  const model2 = new MetabolismModel('HEK293');
  
  model1.setParams(25, 50);
  model2.setParams(25, 50);
  
  for (let i = 0; i < 100; i++) {
    model1.step(0.1);
    model2.step(0.1);
  }
  
  const state1 = model1.getState();
  const state2 = model2.getState();
  
  const passed = Math.abs(state1.specificLactateProduction - state2.specificLactateProduction) > 0.01;

  return {
    passed,
    message: passed
      ? '不同细胞株表现出不同的代谢特征'
      : '不同细胞株代谢特征无显著差异',
    details: {
      'CHO_K1 qLac': state1.specificLactateProduction.toFixed(4),
      'HEK293 qLac': state2.specificLactateProduction.toFixed(4),
      'CHO_K1 μ': state1.specificGrowthRate.toFixed(5),
      'HEK293 μ': state2.specificGrowthRate.toFixed(5)
    }
  };
});

runner.test('16. 代谢模型 - 诊断功能: 碳平衡计算', async () => {
  const model = new MetabolismModel();
  model.setParams(25, 50);
  for (let i = 0; i < 50; i++) model.step(0.1);
  const diagnostics = model.getDiagnostics();
  
  const passed = diagnostics.carbonBalance && 
                 diagnostics.carbonBalance.closure > 0.5 && 
                 diagnostics.carbonBalance.closure < 1.5;

  return {
    passed,
    message: passed
      ? `碳平衡闭合度: ${diagnostics.carbonBalance.closure.toFixed(3)}`
      : `碳平衡闭合度异常`,
    details: {
      '碳输入': diagnostics.carbonBalance.toPyruvate.toFixed(4),
      '碳输出': (diagnostics.carbonBalance.toTca + diagnostics.carbonBalance.toLactate + diagnostics.carbonBalance.toBiomass).toFixed(4),
      '闭合度': diagnostics.carbonBalance.closure.toFixed(4),
      '平衡差值': diagnostics.carbonBalance.balance.toFixed(4)
    }
  };
});

runner.test('17. 代谢模型 - 诊断功能: 氧化还原平衡', async () => {
  const model = new MetabolismModel();
  model.setParams(25, 50);
  for (let i = 0; i < 50; i++) model.step(0.1);
  const diagnostics = model.getDiagnostics();
  
  const passed = diagnostics.redoxBalance && 
                 diagnostics.redoxBalance.redoxState > 0.5 && 
                 diagnostics.redoxBalance.redoxState < 2.0;

  return {
    passed,
    message: passed
      ? `氧化还原状态: ${diagnostics.redoxBalance.redoxState.toFixed(3)}`
      : `氧化还原状态异常`,
    details: {
      'NADH生成': diagnostics.redoxBalance.nadhProduced.toFixed(4),
      'NADH消耗': diagnostics.redoxBalance.nadhConsumed.toFixed(4),
      '氧化还原比': diagnostics.redoxBalance.redoxState.toFixed(4)
    }
  };
});

runner.test('18. 代谢模型 - 稳态预测功能', async () => {
  const model = new MetabolismModel();
  const prediction = model.predictSteadyState(25, 50);
  
  const passed = prediction && 
                 prediction.predictedGrowthRate > 0 && 
                 prediction.predictedGrowthRate < 0.1;

  return {
    passed,
    message: passed
      ? `稳态预测成功，μ=${prediction.predictedGrowthRate.toFixed(5)} h⁻¹`
      : `稳态预测失败`,
    details: {
      '预测生长速率': prediction.predictedGrowthRate.toFixed(6),
      '预测乳酸速率': prediction.predictedLactateRate.toFixed(4),
      '预测TCA速率': prediction.predictedTcaRate.toFixed(4),
      'TCA分配比例': (prediction.partitioning.toTca * 100).toFixed(1) + '%'
    }
  };
});

runner.test('19. 代谢模型 - 参数优化功能', async () => {
  const model = new MetabolismModel();
  const targetGrowthRate = 0.02;
  const optimizations = model.optimizeParameters(targetGrowthRate);
  
  const passed = optimizations && 
                 optimizations.length > 0 && 
                 optimizations[0].error < 0.01;

  return {
    passed,
    message: passed
      ? `找到${optimizations.length}组参数，最优误差=${optimizations[0].error.toFixed(5)}`
      : `参数优化失败`,
    details: {
      '目标生长速率': targetGrowthRate,
      '最优解Glc': optimizations[0]?.glucose + 'mM',
      '最优解DO': optimizations[0]?.oxygen + '%',
      '最优解误差': optimizations[0]?.error.toFixed(6)
    }
  };
});

runner.test('20. 代谢模型 - 生长曲线记录功能', async () => {
  const model = new MetabolismModel();
  model.setParams(25, 50);
  
  for (let i = 0; i < 150; i++) {
    model.step(0.1);
  }
  
  const growthCurve = model.getGrowthCurve();
  const passed = growthCurve.length >= 10;

  return {
    passed,
    message: passed
      ? `记录了${growthCurve.length}个生长曲线时间点`
      : `生长曲线记录不足`,
    details: {
      '时间点数量': growthCurve.length,
      '初始细胞密度': growthCurve[0]?.cellCount.toFixed(3),
      '最终细胞密度': growthCurve[growthCurve.length-1]?.cellCount.toFixed(3),
      '培养时间': growthCurve[growthCurve.length-1]?.time.toFixed(1)
    }
  };
});

(async () => {
  console.log('\n🚀 开始执行重构后模型测试...\n');
  const allPassed = await runner.run();
  process.exit(allPassed ? 0 : 1);
})();
