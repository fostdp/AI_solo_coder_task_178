const MetabolismModel = require('./metabolism');

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
    console.log('='.repeat(60));
    console.log('🧪 生物反应器代谢模型测试套件');
    console.log('='.repeat(60));
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

    console.log('='.repeat(60));
    console.log(`📊 测试结果: ${this.passed} 通过, ${this.failed} 失败, ${this.tests.length} 总计`);
    console.log('='.repeat(60));

    if (this.failed > 0) {
      console.log();
      console.log('❌ 失败用例明细:');
      console.log('-'.repeat(40));
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

runner.test('1.1: 低氧(5%)时乳酸比生成速率应高于高氧(50%)', async () => {
  const model = new MetabolismModel();
  
  model.reset();
  model.setParams(25, 5);
  for (let i = 0; i < 100; i++) model.step(0.1);
  const lowOxygenState = model.getState();
  
  model.reset();
  model.setParams(25, 50);
  for (let i = 0; i < 100; i++) model.step(0.1);
  const highOxygenState = model.getState();

  const lactateRateLowOxygen = lowOxygenState.specificLactateProduction;
  const lactateRateHighOxygen = highOxygenState.specificLactateProduction;

  const passed = lactateRateLowOxygen > lactateRateHighOxygen;
  
  return {
    passed,
    message: passed 
      ? `低氧乳酸比生成速率(${lactateRateLowOxygen.toFixed(4)}) > 高氧(${lactateRateHighOxygen.toFixed(4)})`
      : `低氧乳酸比生成速率(${lactateRateLowOxygen.toFixed(4)}) 未高于 高氧(${lactateRateHighOxygen.toFixed(4)})`,
    details: {
      '5%溶氧时乳酸比生成速率': lactateRateLowOxygen.toFixed(6),
      '50%溶氧时乳酸比生成速率': lactateRateHighOxygen.toFixed(6),
      '差异倍数': (lactateRateLowOxygen / lactateRateHighOxygen).toFixed(2) + 'x'
    }
  };
});

runner.test('1.2: 溶氧从5%到50%变化时乳酸比生成速率应下降', async () => {
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
      : '乳酸比生成速率未随溶氧增加单调下降',
    details: Object.fromEntries(
      results.map(r => [`DO=${r.oxygen}%`, `qLac=${r.lactateRate.toFixed(4)}`])
    )
  };
});

runner.test('1.3: 低氧时丙酮酸流向乳酸比例应更高', async () => {
  const model = new MetabolismModel();
  
  model.reset();
  model.setParams(25, 5);
  for (let i = 0; i < 50; i++) model.step(0.1);
  const lowOxygenState = model.getState();
  
  model.reset();
  model.setParams(25, 50);
  for (let i = 0; i < 50; i++) model.step(0.1);
  const highOxygenState = model.getState();

  const passed = lowOxygenState.pyruvateToLactateRatio > highOxygenState.pyruvateToLactateRatio;

  return {
    passed,
    message: passed
      ? `低氧乳酸分配比(${lowOxygenState.pyruvateToLactateRatio.toFixed(2)}) > 高氧(${highOxygenState.pyruvateToLactateRatio.toFixed(2)})`
      : `低氧乳酸分配比(${lowOxygenState.pyruvateToLactateRatio.toFixed(2)}) 未高于 高氧(${highOxygenState.pyruvateToLactateRatio.toFixed(2)})`,
    details: {
      '5%溶氧时丙酮酸→乳酸比例': (lowOxygenState.pyruvateToLactateRatio * 100).toFixed(1) + '%',
      '5%溶氧时丙酮酸→TCA比例': (lowOxygenState.pyruvateToTcaRatio * 100).toFixed(1) + '%',
      '50%溶氧时丙酮酸→乳酸比例': (highOxygenState.pyruvateToLactateRatio * 100).toFixed(1) + '%',
      '50%溶氧时丙酮酸→TCA比例': (highOxygenState.pyruvateToTcaRatio * 100).toFixed(1) + '%'
    }
  };
});

runner.test('2.1: 底物抑制计算函数应在高糖时降低', async () => {
  const model = new MetabolismModel();
  
  const inhibition10 = model.calculateSubstrateInhibition(10);
  const inhibition25 = model.calculateSubstrateInhibition(25);
  const inhibition50 = model.calculateSubstrateInhibition(50);
  const inhibition80 = model.calculateSubstrateInhibition(80);

  const passed = inhibition25 > inhibition50 && inhibition50 > inhibition80;

  return {
    passed,
    message: passed
      ? '底物抑制系数随糖浓度增加而下降'
      : '底物抑制系数未随糖浓度增加单调下降',
    details: {
      '10mM时抑制系数': inhibition10.toFixed(4),
      '25mM时抑制系数': inhibition25.toFixed(4),
      '50mM时抑制系数': inhibition50.toFixed(4),
      '80mM时抑制系数': inhibition80.toFixed(4),
      '25→50mM变化': ((inhibition25 - inhibition50) / inhibition25 * 100).toFixed(1) + '% 下降',
      '50→80mM变化': ((inhibition50 - inhibition80) / inhibition50 * 100).toFixed(1) + '% 下降'
    }
  };
});

runner.test('2.2: 葡萄糖50mM时比生长速率应低于25mM', async () => {
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
      ? `25mM比生长速率(${state25.specificGrowthRate.toFixed(4)}) > 50mM(${state50.specificGrowthRate.toFixed(4)})`
      : `25mM比生长速率(${state25.specificGrowthRate.toFixed(4)}) 未高于 50mM(${state50.specificGrowthRate.toFixed(4)})`,
    details: {
      '25mM时比生长速率': state25.specificGrowthRate.toFixed(6),
      '50mM时比生长速率': state50.specificGrowthRate.toFixed(6),
      '生长抑制程度': ((state25.specificGrowthRate - state50.specificGrowthRate) / state25.specificGrowthRate * 100).toFixed(1) + '%'
    }
  };
});

runner.test('2.3: 葡萄糖10-50mM变化时应出现生长抑制趋势', async () => {
  const model = new MetabolismModel();
  const results = [];
  
  for (let glucose = 10; glucose <= 50; glucose += 10) {
    model.reset();
    model.setParams(glucose, 50);
    for (let i = 0; i < 100; i++) model.step(0.1);
    results.push({
      glucose,
      specificGrowthRate: model.getState().specificGrowthRate,
      growthRate: model.getState().growthRate
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
      ? `比生长速率从10mM到50mM单调下降${totalDrop.toFixed(1)}%，存在抑制趋势`
      : '比生长速率未出现下降趋势',
    details: {
      ...Object.fromEntries(
        results.map(r => [`Glc=${r.glucose}mM`, `μ=${r.specificGrowthRate.toFixed(5)}`])
      ),
      '总下降比例': totalDrop.toFixed(1) + '%'
    }
  };
});

runner.test('2.4: 极高葡萄糖(80mM)应显著抑制生长', async () => {
  const model = new MetabolismModel();
  
  model.reset();
  model.setParams(25, 50);
  for (let i = 0; i < 100; i++) model.step(0.1);
  const optimalState = model.getState();
  
  model.reset();
  model.setParams(80, 50);
  for (let i = 0; i < 100; i++) model.step(0.1);
  const highState = model.getState();

  const passed = optimalState.specificGrowthRate > highState.specificGrowthRate * 1.1;

  return {
    passed,
    message: passed
      ? `80mM时比生长速率显著低于25mM`
      : `80mM时比生长速率未显著低于25mM`,
    details: {
      '25mM时比生长速率': optimalState.specificGrowthRate.toFixed(6),
      '80mM时比生长速率': highState.specificGrowthRate.toFixed(6),
      '抑制比例': ((optimalState.specificGrowthRate - highState.specificGrowthRate) / optimalState.specificGrowthRate * 100).toFixed(1) + '%'
    }
  };
});

runner.test('3.1: 代谢状态对象应包含specificGrowthRate字段', async () => {
  const model = new MetabolismModel();
  const state = model.getState();

  const passed = 'specificGrowthRate' in state;

  return {
    passed,
    message: passed
      ? '状态对象包含specificGrowthRate字段'
      : '状态对象缺少specificGrowthRate字段',
    details: {
      'state对象键列表': Object.keys(state).join(', ')
    }
  };
});

runner.test('3.2: 代谢状态对象应包含所有定量生理参数', async () => {
  const model = new MetabolismModel();
  model.setParams(25, 50);
  for (let i = 0; i < 10; i++) model.step(0.1);
  const state = model.getState();

  const requiredFields = [
    'specificGrowthRate',
    'specificGlucoseUptake',
    'specificLactateProduction',
    'pyruvate',
    'lactateFlux',
    'pyruvateToTcaRatio',
    'pyruvateToLactateRatio'
  ];

  const missingFields = requiredFields.filter(f => !(f in state));
  const passed = missingFields.length === 0;

  return {
    passed,
    message: passed
      ? `所有${requiredFields.length}个定量生理参数都存在`
      : `缺少${missingFields.length}个字段: ${missingFields.join(', ')}`,
    details: Object.fromEntries(
      requiredFields.map(f => [f, f in state ? state[f]?.toFixed(4) || state[f] : 'MISSING'])
    )
  };
});

runner.test('3.3: 比生长速率应为非零正值(运行后)', async () => {
  const model = new MetabolismModel();
  model.setParams(25, 50);
  for (let i = 0; i < 50; i++) model.step(0.1);
  const state = model.getState();

  const passed = state.specificGrowthRate > 0;

  return {
    passed,
    message: passed
      ? `比生长速率为正: ${state.specificGrowthRate.toFixed(6)} h⁻¹`
      : `比生长速率非正: ${state.specificGrowthRate}`,
    details: {
      '比生长速率': state.specificGrowthRate.toFixed(8),
      '生长速率': state.growthRate.toFixed(8),
      '细胞计数': state.cellCount.toFixed(4)
    }
  };
});

runner.test('3.4: 比生长速率应与生长速率相关联', async () => {
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
      'growthRate / cellCount': expectedMu.toFixed(8),
      '差值': Math.abs(state.specificGrowthRate - expectedMu).toFixed(10)
    }
  };
});

runner.test('3.5: 比糖耗速率应等于糖酵解通量', async () => {
  const model = new MetabolismModel();
  model.setParams(25, 50);
  for (let i = 0; i < 50; i++) model.step(0.1);
  const state = model.getState();

  const passed = Math.abs(state.specificGlucoseUptake - state.glycolysisFlux) < 0.0001;

  return {
    passed,
    message: passed
      ? '比糖耗速率正确等于糖酵解通量'
      : '比糖耗速率与糖酵解通量不一致',
    details: {
      'specificGlucoseUptake': state.specificGlucoseUptake.toFixed(6),
      'glycolysisFlux': state.glycolysisFlux.toFixed(6)
    }
  };
});

runner.test('3.6: 乳酸产率应在合理范围', async () => {
  const model = new MetabolismModel();
  model.setParams(25, 5);
  for (let i = 0; i < 100; i++) model.step(0.1);
  const state = model.getState();

  const lactateYield = state.glycolysisFlux > 0 
    ? state.lactateFlux / (state.glycolysisFlux * 2)
    : 0;
  
  const passed = lactateYield >= 0 && lactateYield <= 1;

  return {
    passed,
    message: passed
      ? `乳酸产率在合理范围: ${lactateYield.toFixed(2)} mol/mol`
      : `乳酸产率超出范围: ${lactateYield.toFixed(2)}`,
    details: {
      '乳酸产率 YLac/Glc': lactateYield.toFixed(4),
      '乳酸通量': state.lactateFlux.toFixed(4),
      '糖酵解通量': state.glycolysisFlux.toFixed(4)
    }
  };
});

(async () => {
  const allPassed = await runner.run();
  process.exit(allPassed ? 0 : 1);
})();
