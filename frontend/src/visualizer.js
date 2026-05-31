export class BioreactorVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.cells = [];
    this.mediumParticles = [];
    this.lactateParticles = [];
    this.state = {
      cellCount: 1.0,
      glucose: 25.0,
      lactate: 0.0,
      atp: 2.0,
      pyruvate: 0.1,
      dissolvedOxygen: 50.0,
      growthRate: 0.0,
      specificGrowthRate: 0.0,
      glycolysisFlux: 0.0,
      tcaFlux: 0.0,
      lactateFlux: 0.0,
      pyruvateToTcaRatio: 0.5,
      pyruvateToLactateRatio: 0.5
    };
    
    this.initCells();
    this.initMediumParticles();
    this.initLactateParticles();
    this.animate();
  }

  initCells() {
    this.cells = [];
    const baseCount = 30;
    for (let i = 0; i < baseCount; i++) {
      this.cells.push({
        x: Math.random() * (this.canvas.width - 100) + 50,
        y: Math.random() * (this.canvas.height - 150) + 100,
        radius: 15 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        color: `hsl(${180 + Math.random() * 40}, 70%, ${50 + Math.random() * 20}%)`,
        pulse: Math.random() * Math.PI * 2,
        dividing: false,
        divideProgress: 0
      });
    }
  }

  initMediumParticles() {
    this.mediumParticles = [];
    for (let i = 0; i < 80; i++) {
      this.mediumParticles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: 2 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1,
        type: Math.random() > 0.5 ? 'glucose' : 'oxygen',
        alpha: 0.3 + Math.random() * 0.4
      });
    }
  }

  initLactateParticles() {
    this.lactateParticles = [];
    for (let i = 0; i < 30; i++) {
      this.lactateParticles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: 1.5 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        alpha: 0
      });
    }
  }

  updateState(newState) {
    this.state = { ...this.state, ...newState };
    
    const targetCellCount = Math.floor(this.state.cellCount * 30);
    while (this.cells.length < targetCellCount && this.cells.length < 200) {
      const parentCell = this.cells[Math.floor(Math.random() * this.cells.length)];
      this.cells.push({
        x: parentCell.x + (Math.random() - 0.5) * 30,
        y: parentCell.y + (Math.random() - 0.5) * 30,
        radius: 12 + Math.random() * 8,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        color: `hsl(${180 + Math.random() * 40}, 70%, ${50 + Math.random() * 20}%)`,
        pulse: Math.random() * Math.PI * 2,
        dividing: true,
        divideProgress: 0
      });
    }
  }

  update() {
    this.cells.forEach(cell => {
      cell.pulse += 0.05;
      
      if (cell.dividing) {
        cell.divideProgress += 0.02;
        if (cell.divideProgress >= 1) {
          cell.dividing = false;
          cell.divideProgress = 0;
        }
      }

      cell.x += cell.vx + this.state.growthRate * 0.1;
      cell.y += cell.vy + Math.sin(cell.pulse) * 0.2;

      if (cell.x < cell.radius || cell.x > this.canvas.width - cell.radius) cell.vx *= -1;
      if (cell.y < 80 + cell.radius || cell.y > this.canvas.height - cell.radius) cell.vy *= -1;

      cell.x = Math.max(cell.radius, Math.min(this.canvas.width - cell.radius, cell.x));
      cell.y = Math.max(80 + cell.radius, Math.min(this.canvas.height - cell.radius, cell.y));
    });

    this.mediumParticles.forEach(particle => {
      particle.x += particle.vx * (1 + this.state.glycolysisFlux * 0.5);
      particle.y += particle.vy * (1 + this.state.tcaFlux * 0.5);

      if (particle.x < 0 || particle.x > this.canvas.width) particle.vx *= -1;
      if (particle.y < 80 || particle.y > this.canvas.height) particle.vy *= -1;
    });

    this.lactateParticles.forEach(particle => {
      particle.alpha = Math.min(0.6, this.state.lactate / 30) * (0.2 + Math.random() * 0.3);
      particle.x += particle.vx * (1 + this.state.lactateFlux * 0.3);
      particle.y += particle.vy * (1 + this.state.lactateFlux * 0.3);

      if (particle.x < 0 || particle.x > this.canvas.width) particle.vx *= -1;
      if (particle.y < 80 || particle.y > this.canvas.height) particle.vy *= -1;
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawReactorVessel();
    this.drawMedium();
    this.drawMediumParticles();
    this.drawLactateParticles();
    this.drawMetabolicPathways();
    this.drawCells();
    this.drawLegend();
  }

  drawReactorVessel() {
    const gradient = this.ctx.createLinearGradient(20, 70, 20, this.canvas.height - 20);
    gradient.addColorStop(0, 'rgba(100, 150, 200, 0.1)');
    gradient.addColorStop(0.5, 'rgba(100, 150, 200, 0.2)');
    gradient.addColorStop(1, 'rgba(100, 150, 200, 0.1)');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(25, 75, this.canvas.width - 50, this.canvas.height - 95);

    this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(25, 75, this.canvas.width - 50, this.canvas.height - 95);

    this.ctx.fillStyle = 'rgba(60, 80, 100, 0.8)';
    this.ctx.fillRect(20, 60, this.canvas.width - 40, 20);
    this.ctx.strokeRect(20, 60, this.canvas.width - 40, 20);
  }

  drawMedium() {
    const lactateLevel = Math.min(this.state.lactate / 60, 1);
    
    const mediumGradient = this.ctx.createLinearGradient(0, 80, 0, this.canvas.height);
    mediumGradient.addColorStop(0, `rgba(255, ${180 - lactateLevel * 120}, ${180 - lactateLevel * 120}, 0.15)`);
    mediumGradient.addColorStop(1, `rgba(200, ${150 - lactateLevel * 100}, ${150 - lactateLevel * 100}, 0.1)`);
    
    this.ctx.fillStyle = mediumGradient;
    this.ctx.fillRect(25, 75, this.canvas.width - 50, this.canvas.height - 95);
  }

  drawMediumParticles() {
    this.mediumParticles.forEach(particle => {
      const alpha = particle.type === 'glucose' 
        ? particle.alpha * (this.state.glucose / 50)
        : particle.alpha * (this.state.dissolvedOxygen / 100);

      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = particle.type === 'glucose'
        ? `rgba(255, 200, 100, ${alpha})`
        : `rgba(100, 200, 255, ${alpha})`;
      this.ctx.fill();
    });
  }

  drawLactateParticles() {
    this.lactateParticles.forEach(particle => {
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(236, 72, 153, ${particle.alpha})`;
      this.ctx.fill();
    });
  }

  drawCells() {
    this.cells.forEach(cell => {
      const pulseRadius = cell.radius + Math.sin(cell.pulse) * 2;
      
      if (cell.dividing) {
        const offset = cell.divideProgress * 15;
        this.drawCell(cell.x - offset, cell.y, pulseRadius * 0.8, cell.color);
        this.drawCell(cell.x + offset, cell.y, pulseRadius * 0.8, cell.color);
      } else {
        this.drawCell(cell.x, cell.y, pulseRadius, cell.color);
      }
    });
  }

  drawCell(x, y, radius, color) {
    const gradient = this.ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, 'rgba(0, 50, 80, 0.8)');

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
    
    this.ctx.strokeStyle = 'rgba(150, 220, 255, 0.6)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(100, 150, 200, 0.5)';
    this.ctx.fill();
  }

  drawMetabolicPathways() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    if (this.state.glycolysisFlux > 0) {
      const fluxIntensity = this.state.glycolysisFlux * 1.5;
      this.ctx.strokeStyle = `rgba(255, 150, 50, ${fluxIntensity * 0.5})`;
      this.ctx.lineWidth = 2 + fluxIntensity * 3;
      
      for (let i = 0; i < 5; i++) {
        const angle = (Date.now() / 500 + i * 0.5) % (Math.PI * 2);
        const startX = centerX + Math.cos(angle) * 100;
        const startY = centerY + Math.sin(angle) * 100;
        const endX = centerX + Math.cos(angle) * 160;
        const endY = centerY + Math.sin(angle) * 160;
        
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
      }
    }

    if (this.state.tcaFlux > 0) {
      const fluxIntensity = this.state.tcaFlux * 2;
      this.ctx.strokeStyle = `rgba(50, 200, 150, ${fluxIntensity * 0.6})`;
      this.ctx.lineWidth = 2 + fluxIntensity * 2;
      
      for (let i = 0; i < 3; i++) {
        const angle = Date.now() / 1000 + i * (Math.PI * 2 / 3);
        const radius = 40 + fluxIntensity * 15;
        
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, angle, angle + Math.PI * 0.8);
        this.ctx.stroke();
      }
    }

    if (this.state.lactateFlux > 0) {
      const fluxIntensity = this.state.lactateFlux;
      this.ctx.strokeStyle = `rgba(236, 72, 153, ${fluxIntensity * 0.5})`;
      this.ctx.lineWidth = 1 + fluxIntensity * 2;
      
      for (let i = 0; i < 4; i++) {
        const angle = (Date.now() / 800 + i * Math.PI / 2) % (Math.PI * 2);
        const startX = centerX + Math.cos(angle) * 50;
        const startY = centerY + Math.sin(angle) * 50;
        const endX = centerX + Math.cos(angle) * 120;
        const endY = centerY + Math.sin(angle) * 120;
        
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
      }
    }

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255, 180, 100, 0.3)';
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(255, 150, 50, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.font = 'bold 10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('PYR', centerX, centerY + 4);
  }

  drawLegend() {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('🟠 葡萄糖', 40, 50);
    this.ctx.fillText('🔵 氧气', 130, 50);
    this.ctx.fillText('🟣 乳酸', 200, 50);
    this.ctx.fillText('🟢 TCA循环', 270, 50);
    this.ctx.fillText('🟠 糖酵解', 360, 50);
    this.ctx.fillText('🔴 乳酸生成', 450, 50);
    this.ctx.fillText('⭕ 丙酮酸节点', 540, 50);
  }

  animate() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}
