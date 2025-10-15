// 2048State.js
import Phaser from "../libs/phaser"

let {
    windowWidth,
    windowHeight
} = wx.getSystemInfoSync();

const GRID_SIZE = 4;
const TILE_SIZE = Math.floor(windowWidth * 0.18);
const GRID_PADDING = Math.floor(windowWidth * 0.02);

// 更丰富的颜色方案
const TILE_COLORS = {
    0: 0xcdc1b4,
    2: 0xeee4da,
    4: 0xede0c8,
    8: 0xf2b179,
    16: 0xf59563,
    32: 0xf67c5f,
    64: 0xf65e3b,
    128: 0xedcf72,
    256: 0xedcc61,
    512: 0xedc850,
    1024: 0xedc53f,
    2048: 0xedc22e,
    4096: 0xedc22e,
    8192: 0xedc22e
};

// 文字颜色配置
const TEXT_COLORS = {
    2: "#776e65",
    4: "#776e65",
    8: "#f9f6f2",
    16: "#f9f6f2",
    32: "#f9f6f2",
    64: "#f9f6f2",
    128: "#f9f6f2",
    256: "#f9f6f2",
    512: "#f9f6f2",
    1024: "#f9f6f2",
    2048: "#f9f6f2"
};

export default class _2048State extends Phaser.State {
    init(param) {
        this.score = 0;
        this.grid = this.createEmptyGrid();
        this.scoreText = null;
        this.bestScoreText = null;
        
        // 样式配置
        this.styles = {
            backgroundColor: 0xfaf8ef,
            gridColor: 0xbbada0,
            textColor: "#776e65",
            accentColor: "#e94560"
        };
    }

    preload() {
        this.game.load.image("back", "images/back.png");
    }

    create() {
        this.drawBg();
        this.spawnTile();
        this.spawnTile();
        
        this.createUI();
        this.setupTouchControls();
        this.drawGrid();
    }

    createUI() {
        // 返回按钮 - 添加动画效果
        const backBtn = this.game.add.image(20, 20, "back");
        backBtn.inputEnabled = true;
        backBtn.input.useHandCursor = true;
        
        // 按钮悬停动画
        backBtn.events.onInputOver.add(() => {
            this.game.add.tween(backBtn).to({ scaleX: 1.1, scaleY: 1.1 }, 150, Phaser.Easing.Back.Out, true);
        });
        backBtn.events.onInputOut.add(() => {
            this.game.add.tween(backBtn).to({ scaleX: 1, scaleY: 1 }, 150, Phaser.Easing.Back.Out, true);
        });
        backBtn.events.onInputDown.add(() => {
            this.shutdown();
            this.game.state.clearCurrentState();
            this.game.input.reset();
            this.game.state.start("GameState");
        }, this);

        // 游戏标题
        const titleText = this.game.add.text(windowWidth / 2, 40, "2048", {
            font: "bold 36px Arial",
            fill: "#776e65",
            align: "center",
            stroke: "#fff",
            strokeThickness: 3,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: "#000",
                blur: 4
            }
        });
        titleText.anchor.set(0.5);

        // 分数显示 - 样式优化
        this.scoreText = this.game.add.text(windowWidth / 2, 85, `分数: ${this.score}`, {
            font: "bold 20px Arial",
            fill: "#f8f8f8",
            align: "center",
            stroke: "#333",
            strokeThickness: 2,
            backgroundColor: "#bbada0",
            padding: { x: 15, y: 8 }
        });
        this.scoreText.anchor.set(0.5);
        
        // 添加分数背景框
        const scoreBg = this.game.add.graphics(this.scoreText.x - this.scoreText.width/2 - 5, this.scoreText.y - this.scoreText.height/2 - 5);
        scoreBg.beginFill(0xbbada0, 0.9);
        scoreBg.drawRoundedRect(0, 0, this.scoreText.width + 10, this.scoreText.height + 10, 8);
        scoreBg.endFill();
        scoreBg.alpha = 0.8;
    }

    drawBg() {
        this.game.stage.backgroundColor = this.styles.backgroundColor;
        
        // 添加背景纹理
        const bgPattern = this.game.add.graphics(0, 0);
        bgPattern.beginFill(0xeee4da, 0.3);
        for (let i = 0; i < windowWidth; i += 40) {
            for (let j = 0; j < windowHeight; j += 40) {
                if ((i + j) % 80 === 0) {
                    bgPattern.drawRect(i, j, 20, 20);
                }
            }
        }
        bgPattern.endFill();
    }

    setupTouchControls() {
        this.startX = 0;
        this.startY = 0;
        this.game.canvas.addEventListener('touchstart', this._ts = (e) => {
            if (e.touches.length === 1) {
                this.startX = e.touches[0].clientX;
                this.startY = e.touches[0].clientY;
            }
        });
        this.game.canvas.addEventListener('touchend', this._te = (e) => {
            if (e.changedTouches.length === 1) {
                let dx = e.changedTouches[0].clientX - this.startX;
                let dy = e.changedTouches[0].clientY - this.startY;
                let moved = false;
                if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20) {
                    if (dx > 0) {
                        moved = this.moveRight();
                    } else if (dx < 0) {
                        moved = this.moveLeft();
                    }
                } else if (Math.abs(dy) > 20) {
                    if (dy > 0) {
                        moved = this.moveDown();
                    } else if (dy < 0) {
                        moved = this.moveUp();
                    }
                }
                if (moved) {
                    this.spawnTile();
                    this.drawGrid();
                    if (this.checkWin()) {
                        wx.showModal && wx.showModal({ 
                            title: '🎉 恭喜', 
                            content: '你赢得了2048！', 
                            showCancel: false,
                            confirmColor: '#e94560'
                        });
                    } else if (this.checkGameOver()) {
                        wx.showModal && wx.showModal({ 
                            title: '游戏结束', 
                            content: '没有可移动的方块了', 
                            showCancel: false,
                            confirmColor: '#e94560'
                        });
                    }
                }
            }
        });
    }

    shutdown() {
        this.sound && this.sound.stopAll();
        if (this.tiles) {
            this.tiles.forEach(row => row.forEach(tile => {
                if (tile) {
                    if (tile.text) tile.text.destroy();
                    if (tile.glow) tile.glow.destroy();
                    tile.destroy();
                }
            }));
            this.tiles = null;
        }
        if (this.scoreText) {
            this.scoreText.destroy();
            this.scoreText = null;
        }
        this.world.removeAll(true);
        this.game.input.onDown.removeAll();
        this.game.input.onUp.removeAll();
        this.game.canvas.removeEventListener('touchstart', this._ts);
        this.game.canvas.removeEventListener('touchend', this._te);
    }

    checkWin() {
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                if (this.grid[i][j] === 2048) return true;
            }
        }
        return false;
    }

    checkGameOver() {
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                if (this.grid[i][j] === 0) return false;
                if (j < GRID_SIZE - 1 && this.grid[i][j] === this.grid[i][j + 1]) return false;
                if (i < GRID_SIZE - 1 && this.grid[i][j] === this.grid[i + 1][j]) return false;
            }
        }
        return true;
    }

    createEmptyGrid() {
        let grid = [];
        for (let i = 0; i < GRID_SIZE; i++) {
            grid[i] = [];
            for (let j = 0; j < GRID_SIZE; j++) {
                grid[i][j] = 0;
            }
        }
        return grid;
    }

    drawGrid() {
        if (this.tiles) {
            this.tiles.forEach(row => row.forEach(tile => {
                if (tile) {
                    if (tile.text) tile.text.destroy();
                    if (tile.glow) tile.glow.destroy();
                    tile.destroy();
                }
            }));
        }
        this.tiles = [];
        const gridWidth = GRID_SIZE * TILE_SIZE + (GRID_SIZE + 1) * GRID_PADDING;
        const offsetX = (windowWidth - gridWidth) / 2;
        
        // 绘制网格背景
        const gridBg = this.game.add.graphics(offsetX - GRID_PADDING, 120 - GRID_PADDING);
        gridBg.beginFill(0xbbada0, 0.8);
        gridBg.drawRoundedRect(0, 0, gridWidth, gridWidth, 10);
        gridBg.endFill();

        for (let i = 0; i < GRID_SIZE; i++) {
            this.tiles[i] = [];
            for (let j = 0; j < GRID_SIZE; j++) {
                let value = this.grid[i][j];
                let x = offsetX + GRID_PADDING + j * (TILE_SIZE + GRID_PADDING);
                let y = 120 + GRID_PADDING + i * (TILE_SIZE + GRID_PADDING);
                let color = TILE_COLORS[value] || 0x3c3a32;
                
                // 创建方块
                let tile = this.game.add.graphics(x, y);
                tile.beginFill(color);
                tile.drawRoundedRect(0, 0, TILE_SIZE, TILE_SIZE, 6);
                tile.endFill();
                
                // 添加3D效果
                tile.beginFill(0xffffff, 0.2);
                tile.drawRect(2, 2, TILE_SIZE - 8, 4);
                tile.drawRect(2, 2, 4, TILE_SIZE - 8);
                tile.endFill();
                
                tile.beginFill(0x000000, 0.1);
                tile.drawRect(TILE_SIZE - 6, 4, 4, TILE_SIZE - 8);
                tile.drawRect(4, TILE_SIZE - 6, TILE_SIZE - 8, 4);
                tile.endFill();

                if (value) {
                    let textColor = TEXT_COLORS[value] || "#f9f6f2";
                    let fontSize = value < 100 ? 32 : value < 1000 ? 28 : 24;
                    
                    let text = this.game.add.text(x + TILE_SIZE / 2, y + TILE_SIZE / 2, value, {
                        font: `bold ${fontSize}px Arial`,
                        fill: textColor,
                        align: "center",
                        stroke: value <= 4 ? "#000000" : "#ffffff",
                        strokeThickness: value <= 4 ? 1 : 2
                    });
                    text.anchor.set(0.5);
                    tile.text = text;
                    
                    // 为大数字添加发光效果
                    if (value >= 128) {
                        let glow = this.game.add.graphics(x, y);
                        glow.lineStyle(3, 0xffffff, 0.3);
                        glow.drawRoundedRect(0, 0, TILE_SIZE, TILE_SIZE, 6);
                        tile.glow = glow;
                    }
                }
                this.tiles[i][j] = tile;
            }
        }
        
        if (this.scoreText) {
            this.scoreText.setText(`分数: ${this.score}`);
            // 分数更新动画
            this.game.add.tween(this.scoreText.scale)
                .to({ x: 1.1, y: 1.1 }, 100, Phaser.Easing.Back.Out, true)
                .to({ x: 1, y: 1 }, 100, Phaser.Easing.Back.In, true);
        }
    }

    spawnTile() {
        let empty = [];
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                if (this.grid[i][j] === 0) empty.push({ i, j });
            }
        }
        if (empty.length === 0) return false;
        let pos = empty[Math.floor(Math.random() * empty.length)];
        this.grid[pos.i][pos.j] = Math.random() < 0.9 ? 2 : 4;
        
        // 新方块出现动画
        if (this.tiles && this.tiles[pos.i] && this.tiles[pos.i][pos.j]) {
            let tile = this.tiles[pos.i][pos.j];
            tile.scale.set(0);
            this.game.add.tween(tile.scale)
                .to({ x: 1, y: 1 }, 200, Phaser.Easing.Back.Out, true);
        }
        return true;
    }

    moveLeft() {
        let moved = this.performMove("left");
        if (moved) this.playMoveAnimation();
        return moved;
    }

    moveRight() {
        let moved = this.performMove("right");
        if (moved) this.playMoveAnimation();
        return moved;
    }

    moveUp() {
        let moved = this.performMove("up");
        if (moved) this.playMoveAnimation();
        return moved;
    }

    moveDown() {
        let moved = this.performMove("down");
        if (moved) this.playMoveAnimation();
        return moved;
    }

    performMove(direction) {
        // 原有的移动逻辑保持不变
        let moved = false;
        
        if (direction === "left") {
            for (let i = 0; i < GRID_SIZE; i++) {
                let row = this.grid[i];
                let merged = [false, false, false, false];
                for (let j = 1; j < GRID_SIZE; j++) {
                    if (row[j] === 0) continue;
                    let k = j;
                    while (k > 0 && row[k - 1] === 0) {
                        row[k - 1] = row[k];
                        row[k] = 0;
                        k--;
                        moved = true;
                    }
                    if (k > 0 && row[k - 1] === row[k] && !merged[k - 1] && !merged[k]) {
                        row[k - 1] *= 2;
                        this.score += row[k - 1];
                        row[k] = 0;
                        merged[k - 1] = true;
                        moved = true;
                    }
                }
            }
        } else if (direction === "right") {
            for (let i = 0; i < GRID_SIZE; i++) {
                let row = this.grid[i];
                let merged = [false, false, false, false];
                for (let j = GRID_SIZE - 2; j >= 0; j--) {
                    if (row[j] === 0) continue;
                    let k = j;
                    while (k < GRID_SIZE - 1 && row[k + 1] === 0) {
                        row[k + 1] = row[k];
                        row[k] = 0;
                        k++;
                        moved = true;
                    }
                    if (k < GRID_SIZE - 1 && row[k + 1] === row[k] && !merged[k + 1] && !merged[k]) {
                        row[k + 1] *= 2;
                        this.score += row[k + 1];
                        row[k] = 0;
                        merged[k + 1] = true;
                        moved = true;
                    }
                }
            }
        } else if (direction === "up") {
            for (let j = 0; j < GRID_SIZE; j++) {
                let merged = [false, false, false, false];
                for (let i = 1; i < GRID_SIZE; i++) {
                    if (this.grid[i][j] === 0) continue;
                    let k = i;
                    while (k > 0 && this.grid[k - 1][j] === 0) {
                        this.grid[k - 1][j] = this.grid[k][j];
                        this.grid[k][j] = 0;
                        k--;
                        moved = true;
                    }
                    if (k > 0 && this.grid[k - 1][j] === this.grid[k][j] && !merged[k - 1] && !merged[k]) {
                        this.grid[k - 1][j] *= 2;
                        this.score += this.grid[k - 1][j];
                        this.grid[k][j] = 0;
                        merged[k - 1] = true;
                        moved = true;
                    }
                }
            }
        } else if (direction === "down") {
            for (let j = 0; j < GRID_SIZE; j++) {
                let merged = [false, false, false, false];
                for (let i = GRID_SIZE - 2; i >= 0; i--) {
                    if (this.grid[i][j] === 0) continue;
                    let k = i;
                    while (k < GRID_SIZE - 1 && this.grid[k + 1][j] === 0) {
                        this.grid[k + 1][j] = this.grid[k][j];
                        this.grid[k][j] = 0;
                        k++;
                        moved = true;
                    }
                    if (k < GRID_SIZE - 1 && this.grid[k + 1][j] === this.grid[k][j] && !merged[k + 1] && !merged[k]) {
                        this.grid[k + 1][j] *= 2;
                        this.score += this.grid[k + 1][j];
                        this.grid[k][j] = 0;
                        merged[k + 1] = true;
                        moved = true;
                    }
                }
            }
        }
        
        return moved;
    }

    playMoveAnimation() {
        // 轻微的屏幕震动效果
        this.game.world.x = 2;
        this.game.add.tween(this.game.world)
            .to({ x: 0 }, 100, Phaser.Easing.Bounce.Out, true);
    }

    update() {}

    render() {}
}