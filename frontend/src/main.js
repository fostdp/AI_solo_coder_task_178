import { BioreactorVisualizer } from './visualizer.js';
import { MetabolicNetwork } from './metabolic-network.js';
import './style.css';

class App {
  constructor() {
    this.visualizer = new BioreactorVisualizer('bioreactorCanvas');
    this.metabolicNetwork = new MetabolicNetwork('networkCanvas');
    this.isRunning = false;
    this.updateInterval = null;
    this.currentState = null;
    this.currentTab = 'reactor';
    
    this.bindEvents();
    this.fetchState();
    this.startUIUpdate();
  }

  bindEvents() {
    document.getElementById('startBtn').addEventListener('click', () => this.startSimulation());
    document.getElementById('stopBtn').addEventListener('click', () => this.stopSimulation());
    document.getElementById('resetBtn').addEventListener('click', () => this.resetSimulation());

    const glucoseSlider = document.getElementById('glucoseSlider');
    const oxygenSlider = document.getElementById('oxygenSlider');

    glucoseSlider.addEventListener('input', (e) => {
      document.getElementById('glucoseValue').textContent = e.target.value;
      this.updateParams();
    });

    oxygenSlider.addEventListener('input', (e) => {
      document.getElementById('oxygenValue').textContent = e.target.value;
      this.updateParams();
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    document.getElementById('optimizeBtn').addEventListener('click', () => this.optimizeParameters());
    document.getElementById('fluxAnalysisBtn').addEventListener('click', () => this.getFluxAnalysis());
    document.getElementById('feedingStrategyBtn').addEventListener('click', () => this.getFeedingStrategy());
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Tab`);
    });

    if (tabName === 'network' && this.currentState) {
      this.metabolicNetwork.updateState(this.currentState);
    }
  }

  async startSimulation() {
    await fetch('/api/start', { method: 'POST' });
    this.isRunning = true;
    this.startUpdateLoop();
  }

  async stopSimulation() {
    await fetch('/api/stop', { method: 'POST' });
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  async resetSimulation() {
    const response = await fetch('/api/reset', { method: 'POST' });
    const state = await response.json();
    this.updateUI(state);
    this.visualizer.initCells();
    this.visualizer.initLactateParticles();
  }

  async updateParams() {
    const glucose = parseFloat(document.getElementById('glucoseSlider').value);
    const dissolvedOxygen = parseFloat(document.getElementById('oxygenSlider').value);

    await fetch('/api/params', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ glucose, dissolvedOxygen })
    });
  }

  async fetchState() {
    try {
      const response = await fetch('/api/state');
      const state = await response.json();
      this.currentState = state;
      this.updateUI(state);
    } catch (e) {
      console.error('Failed to fetch state:', e);
    }
  }

  async optimizeParameters() {
    const targetGrowthRate = 0.02;
    try {
      const response = await fetch('/api/optimize-parameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetGrowthRate })
      });
      const optimizations = await response.json();
      this.displayOptimizationResults(optimizations);
    } catch (e) {
      console.error('Optimization failed:', e);
    }
  }

  async getFluxAnalysis() {
    try {
      const response = await fetch('/api/diagnostics');
      const diagnostics = await response.json();
      this.displayFluxAnalysis(diagnostics);
    } catch (e) {
      console.error('Flux analysis failed:', e);
    }
  }

  async getFeedingStrategy() {
    try {
      const response = await fetch('/api/feeding-strategy');
      const strategy = await response.json();
      this.displayFeedingStrategy(strategy);
    } catch (e) {
      console.error('Feeding strategy failed:', e);
    }
  }

  startUpdateLoop() {
    if (this.updateInterval) return;
    this.updateInterval = setInterval(() => this.fetchState(), 100);
  }

  startUIUpdate() {
    setInterval(() => {
      if (this.currentTab === 'network' && this.currentState) {
        this.metabolicNetwork.updateState(this.currentState);
      }
    }, 500);
  }

  updateUI(state) {
    this.visualizer.updateState(state);

    document.getElementById('cellCount').textContent = state.cellCount.toFixed(2);
    document.getElementById('currentGlucose').textContent = state.glucose.toFixed(2);
    document.getElementById('lactate').textContent = state.lactate.toFixed(2);
    document.getElementById('pyruvate').textContent = (state.pyruvate || 0).toFixed(2);
    document.getElementById('atp').textContent = state.atp.toFixed(2);
    document.getElementById('currentOxygen').textContent = state.dissolvedOxygen.toFixed(2);

    document.getElementById('specificGrowthRate').textContent = (state.specificGrowthRate || 0).toFixed(4);
    document.getElementById('specificGlucoseUptake').textContent = (state.specificGlucoseUptake || 0).toFixed(3);
    document.getElementById('specificLactateProduction').textContent = (state.specificLactateProduction || 0).toFixed(3);
    
    const lactateYield = state.glycolysisFlux > 0 
      ? (state.lactateFlux || 0) / (state.glycolysisFlux * 2) 
      : 0;
    document.getElementById('lactateYield').textContent = lactateYield.toFixed(2);

    document.getElementById('glycolysisFlux').style.width = `${state.glycolysisFlux * 100}%`;
    document.getElementById('glycolysisValue').textContent = state.glycolysisFlux.toFixed(3);
    
    document.getElementById('tcaFlux').style.width = `${state.tcaFlux * 150}%`;
    document.getElementById('tcaValue').textContent = state.tcaFlux.toFixed(3);

    document.getElementById('lactateFlux').style.width = `${(state.lactateFlux || 0) * 80}%`;
    document.getElementById('lactateFluxValue').textContent = (state.lactateFlux || 0).toFixed(3);

    const tcaRatio = (state.pyruvateToTcaRatio || 0.5) * 100;
    const lactateRatio = (state.pyruvateToLactateRatio || 0.5) * 100;
    document.getElementById('tcaPartition').style.width = `${tcaRatio}%`;
    document.getElementById('lactatePartition').style.width = `${lactateRatio}%`;
    document.getElementById('tcaPartitionLabel').textContent = `TCA: ${tcaRatio.toFixed(0)}%`;
    document.getElementById('lactatePartitionLabel').textContent = `乳酸: ${lactateRatio.toFixed(0)}%`;

    if ('glucoseEffect' in state) {
      document.getElementById('glucoseEffect').textContent = state.glucoseEffect.toFixed(3);
    }
    if ('oxygenEffect' in state) {
      document.getElementById('oxygenEffect').textContent = state.oxygenEffect.toFixed(3);
    }
    if ('lactateInhibition' in state) {
      document.getElementById('lactateInhibition').textContent = state.lactateInhibition.toFixed(3);
    }
    if ('viability' in state) {
      document.getElementById('viability').textContent = (state.viability * 100).toFixed(1);
    }
  }

  displayOptimizationResults(optimizations) {
    const container = document.getElementById('optimizationResults');
    container.innerHTML = '<h4>🎯 参数优化推荐</h4>';
    
    if (optimizations && optimizations.length > 0) {
      const list = document.createElement('div');
      list.className = 'optimization-list';
      
      optimizations.forEach((opt, idx) => {
        const item = document.createElement('div');
        item.className = 'optimization-item';
        item.innerHTML = `
          <span class="rank">#${idx + 1}</span>
          <span>葡萄糖: <strong>${opt.glucose}mM</strong></span>
          <span>溶氧: <strong>${opt.oxygen}%</strong></span>
          <span>误差: <strong>${(opt.error * 100).toFixed(2)}%</strong></span>
        `;
        list.appendChild(item);
      });
      
      container.appendChild(list);
    }
  }

  displayFluxAnalysis(diagnostics) {
    const container = document.getElementById('analysisResults');
    container.innerHTML = '<h4>📊 代谢通量分析</h4>';
    
    if (diagnostics) {
      const { carbonBalance, redoxBalance, energeticYield } = diagnostics;
      
      container.innerHTML += `
        <div class="analysis-grid">
          <div class="analysis-item">
            <div class="analysis-label">碳平衡闭合度</div>
            <div class="analysis-value ${carbonBalance.closure > 0.9 && carbonBalance.closure < 1.1 ? 'good' : 'warning'}">
              ${(carbonBalance.closure * 100).toFixed(1)}%
            </div>
          </div>
          <div class="analysis-item">
            <div class="analysis-label">氧化还原状态</div>
            <div class="analysis-value ${redoxBalance.redoxState > 0.8 && redoxBalance.redoxState < 1.2 ? 'good' : 'warning'}">
              ${redoxBalance.redoxState.toFixed(2)}
            </div>
          </div>
          <div class="analysis-item">
            <div class="analysis-label">ATP产生速率</div>
            <div class="analysis-value good">
              ${energeticYield.atpProduced.toFixed(2)} mM/h
            </div>
          </div>
          <div class="analysis-item">
            <div class="analysis-label">生长得率</div>
            <div class="analysis-value">
              ${(energeticYield.growthYield * 100).toFixed(1)}%
            </div>
          </div>
        </div>
        <div class="balance-details">
          <p>碳输入: ${carbonBalance.toPyruvate.toFixed(3)} → TCA: ${carbonBalance.toTca.toFixed(3)} + 乳酸: ${carbonBalance.toLactate.toFixed(3)} + 生物质: ${carbonBalance.toBiomass.toFixed(3)}</p>
          <p>NADH: 产生 ${redoxBalance.nadhProduced.toFixed(3)} - 消耗 ${redoxBalance.nadhConsumed.toFixed(3)} = ${(redoxBalance.nadhProduced - redoxBalance.nadhConsumed).toFixed(3)}</p>
        </div>
      `;
    }
  }

  displayFeedingStrategy(strategy) {
    const container = document.getElementById('feedingResults');
    container.innerHTML = '<h4>💡 补料策略推荐</h4>';
    
    if (strategy) {
      container.innerHTML += `
        <div class="strategy-card">
          <div class="strategy-status ${strategy.status}">
            <span class="status-icon">${strategy.status === 'optimal' ? '✅' : strategy.status === 'feed' ? '⚠️' : '🔴'}</span>
            <span>${strategy.status === 'optimal' ? '状态最优' : strategy.status === 'feed' ? '需要补料' : '代谢异常'}</span>
          </div>
          <div class="strategy-details">
            <div class="strategy-item">
              <span class="strategy-label">当前葡萄糖:</span>
              <span class="strategy-value">${strategy.currentGlucose.toFixed(1)} mM</span>
            </div>
            <div class="strategy-item">
              <span class="strategy-label">推荐补糖速率:</span>
              <span class="strategy-value highlight">${strategy.feedingRate.toFixed(2)} mM/h</span>
            </div>
            <div class="strategy-item">
              <span class="strategy-label">预计生长速率:</span>
              <span class="strategy-value">${(strategy.predictedGrowthRate * 100).toFixed(2)}%/h</span>
            </div>
            <div class="strategy-item">
              <span class="strategy-label">乳酸积累风险:</span>
              <span class="strategy-value ${strategy.lactateRisk === 'low' ? 'good' : strategy.lactateRisk === 'medium' ? 'warning' : 'danger'}">
                ${strategy.lactateRisk === 'low' ? '低' : strategy.lactateRisk === 'medium' ? '中' : '高'}
              </span>
            </div>
          </div>
          <div class="strategy-recommendation">
            <strong>建议:</strong> ${strategy.recommendation}
          </div>
        </div>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
