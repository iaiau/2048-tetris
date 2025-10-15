// gameState.js
import Phaser from '../libs/phaser';
const { windowWidth, windowHeight } = wx.getSystemInfoSync();

const GAMES = [
  { key: '2048', icon: 'images/2048.svg', state: '_2048State', angle: 0, name: '2048' },
  { key: 'tetris', icon: 'images/tetris.svg', state: 'TetrisState', angle: 180, name: '俄罗斯方块' }
];

const RADIUS = 120;
const CENTER = { x: windowWidth / 2, y: windowHeight / 2 };

export default class GameState extends Phaser.State {
  init() { }
  preload() {
    GAMES.forEach(g => this.game.load.image(g.key, `${g.icon}`));
    this.game.load.image("gamebg", "images/gamebg.svg");
    // 预载分享按钮图标
    this.game.load.image("share_btn", "images/share_btn.svg");
  }
  create() {
    this.drawBg();
    this.buildCarousel();
    this.initInput();
    this.addShareButton(); // 添加分享按钮
    
    // 居中游戏名文本
    this.nameText = this.game.add.text(CENTER.x, windowHeight * 0.0625 + 20, '', {
      font: 'bold 28px Arial',
      fill: '#333'
    });
    this.nameText.anchor.set(0.5);
    this.updateIconPositions();
  }
  drawBg() {
    const g = this.game.add.image(0, 0, "gamebg");
    g.width = windowWidth;
    g.height = windowHeight;

  }
  buildCarousel() {
    this.carousel = {
      sprites: [],
      angles: [],
      currentAng: 0,
      speed: 0,
      isDragging: false,
      lastPointerX: 0
    };
    GAMES.forEach((cfg, idx) => {
      const sp = this.game.add.sprite(0, 0, cfg.key);
      sp.anchor.set(0.5);
      sp.scale.set(60 / Math.max(sp.width, sp.height));
      sp.inputEnabled = true;
      sp.events.onInputDown.add(() => this.onIconClicked(idx));
      this.carousel.sprites.push(sp);
      this.carousel.angles.push(cfg.angle);
    });
  }
  // 添加分享按钮
  addShareButton() {
    // 创建分享按钮
    const shareBtn = this.game.add.sprite(windowWidth - 40, windowHeight * 0.07 + 20, "share_btn");
    shareBtn.anchor.set(0.5);
    shareBtn.scale.set(1.0); // 根据需要调整大小
    shareBtn.inputEnabled = true;
    
    // 添加点击事件
    shareBtn.events.onInputDown.add(this.shareGame, this);
  }
  // 分享功能实现
  shareGame() {
    // 获取当前选中的游戏
    const topIdx = this.getTopGameIndex();
    const currentGame = GAMES[topIdx];
    
    // 微信小游戏分享
    if (wx && wx.shareAppMessage) {
      wx.shareAppMessage({
        title: `快来玩${currentGame.name}小游戏！`,
        imageUrl: `${currentGame.icon}`, // 可以设置分享图片的URL
        query: `game=${currentGame.key}`, // 可以传递游戏参数
        success: () => {
          console.log('分享成功');
        },
        fail: (err) => {
          console.log('分享失败', err);
        }
      });
    } else {
      console.log('分享功能在当前环境不可用');
      // 备用分享方案或提示
      this.showShareTip(currentGame.name);
    }
  }
  // 获取当前顶部游戏索引
  getTopGameIndex() {
    const { sprites, angles, currentAng } = this.carousel;
    let topIdx = 0;
    let minY = Infinity;
    
    sprites.forEach((sp, i) => {
      const ang = (angles[i] + currentAng) * Math.PI / 180;
      const y = CENTER.y - RADIUS * Math.cos(ang);
      if (y < minY) { 
        minY = y; 
        topIdx = i; 
      }
    });
    
    return topIdx;
  }
  // 显示分享提示（备用方案）
  showShareTip(gameName) {
    // 创建一个简单的文本提示
    const tip = this.game.add.text(CENTER.x, CENTER.y + 150, `分享${gameName}给好友`, {
      font: 'bold 20px Arial',
      fill: '#fff',
      backgroundColor: '#000',
      padding: { x: 10, y: 5 }
    });
    tip.anchor.set(0.5);
    
    // 3秒后消失
    this.game.time.events.add(3000, () => {
      tip.destroy();
    });
  }
  updateIconPositions() {
    const { sprites, angles, currentAng } = this.carousel;
    let topIdx = 0;
    let minY = Infinity;
    sprites.forEach((sp, i) => {
      const ang = (angles[i] + currentAng) * Math.PI / 180;
      sp.x = CENTER.x + RADIUS * Math.sin(ang);
      sp.y = CENTER.y - RADIUS * Math.cos(ang);
      if (sp.y < minY) { minY = sp.y; topIdx = i; }
    });
    sprites.forEach((sp, i) => {
      sp.scale.set(i === topIdx ? 1.0 : 0.6);
      sp.bringToTop();
    });
    sprites[topIdx].bringToTop();
    // 更新中央名称
    this.nameText.setText(GAMES[topIdx].name);
  }
  initInput() {
    this.game.input.onDown.add(p => {
      this.carousel.isDragging = true;
      this.carousel.speed = 0;
      this.carousel.lastPointerX = p.x;
    });
    this.game.input.onUp.add(() => {
      this.carousel.isDragging = false;
    });
  }
  onIconClicked(idx) {
    const { angles, currentAng } = this.carousel;
    const iconAng = (angles[idx] + currentAng) % 360;
    const diff = 360 - (iconAng < 0 ? iconAng + 360 : iconAng);
    if (Math.abs(diff % 360) < 5 || Math.abs(diff % 360) > 355) {
      this.goState(GAMES[idx].state);
    } else {
      this.rotateTo(-angles[idx]);
    }
  }
  rotateTo(targetGlobalAng) {
    this.game.add.tween(this.carousel)
      .to({ currentAng: targetGlobalAng }, 300, Phaser.Easing.Cubic.Out, true)
      .onUpdateCallback(() => this.updateIconPositions())
      .onComplete.add(() => { this.carousel.speed = 0; });
  }
  goState(stateName) {
    this.game.state.start(stateName);
  }
  update() {
    const c = this.carousel;
    if (c.isDragging) {
      const px = this.game.input.x;
      const dx = px - c.lastPointerX;
      c.lastPointerX = px;
      const angDelta = dx * 0.5;
      c.currentAng += angDelta;
      c.speed = angDelta * 60;
    } else {
      if (Math.abs(c.speed) > 0.1) {
        c.currentAng += c.speed / 60;
        c.speed *= 0.95;
      } else {
        c.speed = 0;
      }
    }
    this.updateIconPositions();
  }
}
