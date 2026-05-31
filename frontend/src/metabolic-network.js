export class MetabolicNetwork {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.state = null;
    
    this.nodes = {
      glucose: { x: 100, y: 200, label: '葡萄糖', color: '#f59e0b' },
      glucose6p: { x: 200, y: 150, label: 'G6P', color: '#fbbf24' },
      pyruvate: { x: 350, y: 200, label: '丙酮酸', color: '#f97316' },
      lactate: { x: 500, y: 100, label: '乳酸', color: '#ec4899' },
      acetylCoa: { x: 500, y: 300, label: '乙酰CoA', color: '#8b5cf6' },
      tca: { x: 650, y: 300, label: 'TCA循环', color: '#10b981' },
      atp: { x: 750, y: 200, label: 'ATP', color: '#06b6d4' },
      oxygen: { x: 400, y: 400, label: '氧气', color: '#3b82f6' }
    };
    
    this.pathways = [
      { from: 'glucose', to: 'glucose6p', label: '糖酵解', type: 'glycolysis' },
      { from: 'glucose6p', to: 'pyruvate', label: '', type: 'glycolysis' },
      { from: 'pyruvate', to: 'lactate', label: 'LDH', type: 'lactate' },
      { from: 'pyruvate', to: 'acetylCoa', label: 'PDH', type: 'tca' },
      { from: 'acetylCoa', to: 'tca', label: '', type: 'tca' },
      { from: 'tca', to: 'atp', label: '氧化磷酸化', type: 'energy' },
      { from: 'oxygen', to: 'tca', label: '呼吸链', type: 'energy' }
    ];
    
    this.fluxParticles = [];
    this.animationTime = 0;
    
    this.animate();
  }

  updateState(state) {
    this.state = state;
    
    if (state && this.fluxParticles.length < 50) {
      this.spawnFluxParticles();
    }
  }

  spawnFluxParticles() {
    const { glycolysisFlux, tcaFlux, lactateFlux } = this.state;
    
    if (Math.random() < glycolysisFlux * 0.5) {
      this.fluxParticles.push({
        pathway: 0,
        progress: 0,
        speed: 0.02 + Math.random() * 0.02
      });
    }
    
    if (Math.random() < glycolysisFlux * 0.3) {
      this.fluxParticles.push({
        pathway: 1,
        progress: 0,
        speed: 0.02 + Math.random() * 0.02
      });
    }
    
    if (Math.random() < lactateFlux * 0.4) {
      this.fluxParticles.push({
        pathway: 2,
        progress: 0,
        speed: 0.03 + Math.random() * 0.02
      });
    }
    
    if (Math.random() < tcaFlux * 0.3) {
      this.fluxParticles.push({
        pathway: 3,
        progress: 0,
        speed: 0.02 + Math.random() * 0.02
      });
    }
    
    if (Math.random() < tcaFlux * 0.3) {
      this.fluxParticles.push({
        pathway: 4,
        progress: 0,
        speed: 0.02 + Math.random() * 0.02
      });
    }
    
    if (this.fluxParticles.length > 50) {
      this.fluxParticles.shift();
    }
  }

  getFluxColor(type) {
    const colors = {
      glycolysis: 'rgba(245, 158, 11, 0.8)',
      tca: 'rgba(16, 185, 129, 0.8)',
      lactate: 'rgba(236, 72, 153, 0.8)',
      energy: 'rgba(6, 182, 212, 0.8)'
    };
    return colors[type] || 'rgba(255, 255, 255, 0.5)';
  }

  update() {
    this.animationTime += 0.02;
    
    this.fluxParticles = this.fluxParticles.filter(particle => {
      particle.progress += particle.speed;
      return particle.progress < 1;
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = 'rgba(30, 41, 59)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.drawGrid();
    this.drawPathways();
    this.drawFluxParticles();
    this.drawNodes();
    this.drawInfoPanel();
  }

  drawGrid() {
    this.ctx.strokeStyle = 'rgba(100, 116, 139, 0.1)';
    this.ctx.lineWidth = 1;
    
    for (let x = 0; x < this.canvas.width; x += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    
    for (let y = 0; y < this.canvas.height; y += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  drawPathways() {
    const fluxes = {
      glycolysis: this.state?.glycolysisFlux || 0,
      tca: this.state?.tcaFlux || 0,
      lactate: this.state?.lactateFlux || 0,
      energy: this.state?.tcaFlux || 0
    };
    
    this.pathways.forEach(pathway => {
      const fromNode = this.nodes[pathway.from];
      const toNode = this.nodes[pathway.to];
      const flux = fluxes[pathway.type] || 0;
      
      this.drawArrow(fromNode.x, fromNode.y, toNode.x, toNode.y, pathway.type, flux, pathway.label);
    });
  }

  drawArrow(x1, y1, x2, y2, type, flux, label) {
    const headLength = 10;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const intensity = Math.min(flux, 1);
    
    this.ctx.strokeStyle = this.getFluxColor(type).replace('0.8', 0.3 + intensity * 0.5);
    this.ctx.lineWidth = 2 + intensity * 4;
    this.ctx.lineCap = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2 - headLength * Math.cos(angle), y2 - headLength * Math.sin(angle));
    this.ctx.stroke();
    
    this.ctx.fillStyle = this.getFluxColor(type);
    this.ctx.beginPath();
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(
      x2 - headLength * Math.cos(angle - Math.PI / 6),
      y2 - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      x2 - headLength * Math.cos(angle + Math.PI / 6),
      y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fill();
    
    if (label) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      this.ctx.fillRect(midX - 30, midY - 10, 60, 20);
      
      this.ctx.fillStyle = '#e2e8f0';
      this.ctx.font = '11px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(label, midX, midY + 4);
    }
  }

  drawFluxParticles() {
    this.fluxParticles.forEach(particle => {
      const pathway = this.pathways[particle.pathway];
      const fromNode = this.nodes[pathway.from];
      const toNode = this.nodes[pathway.to];
      
      const x = fromNode.x + (toNode.x - fromNode.x) * particle.progress;
      const y = fromNode.y + (toNode.y - fromNode.y) * particle.progress;
      
      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, 8);
      gradient.addColorStop(0, this.getFluxColor(pathway.type));
      gradient.addColorStop(1, 'transparent');
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 8, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  drawNodes() {
    Object.entries(this.nodes).forEach(([key, node]) => {
      const pulse = Math.sin(this.animationTime * 2 + node.x * 0.01) * 0.1 + 1;
      
      const gradient = this.ctx.createRadialGradient(
        node.x, node.y, 0,
        node.x, node.y, 35 * pulse
      );
      gradient.addColorStop(0, node.color + '80');
      gradient.addColorStop(1, node.color + '00');
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, 35 * pulse, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.fillStyle = node.color;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, 25, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(node.label, node.x, node.y + 4);
      
      if (this.state && this.getNodeValue(key)) {
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '10px Arial';
        this.ctx.fillText(this.getNodeValue(key), node.x, node.y + 45);
      }
    });
  }

  getNodeValue(key) {
    const values = {
      glucose: `${this.state.glucose?.toFixed(1)} mM`,
      pyruvate: `${this.state.pyruvate?.toFixed(2)} mM`,
      lactate: `${this.state.lactate?.toFixed(1)} mM`,
      atp: `${this.state.atp?.toFixed(1)} mM`,
      oxygen: `${this.state.dissolvedOxygen?.toFixed(0)}%`,
      tca: `${this.state.tcaFlux?.toFixed(2)}`
    };
    return values[key] || '';
  }

  drawInfoPanel() {
    if (!this.state) return;
    
    const panelX = 20;
    const panelY = 20;
    const panelWidth = 200;
    const panelHeight = 150;
    
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    this.ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('📊 代谢网络状态', panelX + 15, panelY + 25);
    
    const items = [
      { label: '糖酵解通量', value: this.state.glycolysisFlux?.toFixed(3), color: '#f59e0b' },
      { label: 'TCA通量', value: this.state.tcaFlux?.toFixed(3), color: '#10b981' },
      { label: '乳酸通量', value: this.state.lactateFlux?.toFixed(3), color: '#ec4899' },
      { label: '比生长速率', value: this.state.specificGrowthRate?.toFixed(4), color: '#06b6d4' }
    ];
    
    items.forEach((item, idx) => {
      const y = panelY + 50 + idx * 25;
      
      this.ctx.fillStyle = item.color;
      this.ctx.beginPath();
      this.ctx.arc(panelX + 25, y - 5, 4, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '12px Arial';
      this.ctx.fillText(item.label, panelX + 35, y);
      
      this.ctx.fillStyle = '#f1f5f9';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(item.value, panelX + panelWidth - 15, y);
      this.ctx.textAlign = 'left';
    });
  }

  animate() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}
