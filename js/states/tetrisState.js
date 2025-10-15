import Phaser from "../libs/phaser"

let { windowWidth, windowHeight } = wx.getSystemInfoSync();

let directions = ["left", "down", "right", "rotate"];

// 速度根据等级提升
const levelSpeeds = {
    1: 1000 / 1.5, 2: 1000 / 1.7, 3: 1000 / 1.9, 4: 1000 / 2.1,
    5: 1000 / 2.3, 6: 1000 / 2.5, 7: 1000 / 2.7, 8: 1000 / 2.9,
    9: 1000 / 3.1, 10: 1000 / 3.3, 11: 1000 / 3.5, 12: 1000 / 3.7,
    15: 1000 / 4, 16: 1000 / 4.5, 17: 1000 / 5
};

export default class TetrisState extends Phaser.State {
    init(param) {
        this.level = 1;
        this.score = 0;
        this.isClearing = false;   // 消行动画期间加锁

        // 样式配置
        this.styles = {
            backgroundColor: 0x1a1a2e,
            boardColor: 0x16213e,
            gridColor: 0x0f3460,
            textColor: "#e94560",
            shadowColor: 0x000000,
            blockGlow: 0xffffff,
            previewBgColor: 0x0a0a1a
        };

        // 更丰富的颜色方案
        this.colors = [
            0x00bfff, 0xffd700, 0xba55d3, 0x32cd32,
            0xff6347, 0x4169e1, 0xff8c00, 0xff1493,
            0x00fa9a, 0x9370db, 0xff69b4, 0x20b2aa
        ];

        // 下一个方块相关变量
        this.nextShapeIndex = null;
        this.nextShape = null;
        this.nextColor = null;
        this.previewGraphics = null;
        this.previewContainer = null;
    }

    preload() {
        for (const name of directions) {
            this.game.load.image(name, `images/tetris/${name}.png`);
        }
        this.game.load.image("back", "images/back.png");
    }

    create() {
        this.setupGame();
        this.createUI();
        this.setupControls();

        // 初始化下一个方块
        this.generateNextBlock();
        this.spawnBlock();

        this.startGameLoop();
    }

    setupGame() {
        this.cols = 10;
        this.rows = 20;
        this.blockSize = Math.floor(windowWidth * 0.06);
        this.boardOffsetX = Math.floor(windowWidth * 0.1); // 更靠左，使用百分比而不是居中计算
        this.boardOffsetY = 120;


        // 初始化游戏板
        this.board = [];
        for (let i = 0; i < this.rows; i++) {
            this.board[i] = Array(this.cols).fill(0);
        }

        // 方块形状定义
        this.shapes = [
            [[1, 1, 1, 1]], // I
            [[1, 1], [1, 1]], // O
            [[0, 1, 0], [1, 1, 1]], // T
            [[0, 1, 1], [1, 1, 0]], // S
            [[1, 1, 0], [0, 1, 1]], // Z
            [[1, 0, 0], [1, 1, 1]], // J
            [[0, 0, 1], [1, 1, 1]]  // L
        ];

        // 设置现代化背景
        this.game.stage.backgroundColor = this.styles.backgroundColor;

        // 创建背景网格
        this.createBackgroundGrid();
    }

    createBackgroundGrid() {
        const grid = this.game.add.graphics(0, 0);
        grid.lineStyle(1, this.styles.gridColor, 0.3);

        // 绘制网格线
        for (let i = 0; i <= this.rows; i++) {
            grid.moveTo(this.boardOffsetX, this.boardOffsetY + i * this.blockSize);
            grid.lineTo(this.boardOffsetX + this.cols * this.blockSize, this.boardOffsetY + i * this.blockSize);
        }
        for (let j = 0; j <= this.cols; j++) {
            grid.moveTo(this.boardOffsetX + j * this.blockSize, this.boardOffsetY);
            grid.lineTo(this.boardOffsetX + j * this.blockSize, this.boardOffsetY + this.rows * this.blockSize);
        }
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
            this.cleanupGame();
            this.game.state.start("GameState");
        }, this);

        // 游戏标题
        const titleText = this.game.add.text(windowWidth / 2, 30, "俄罗斯方块", {
            font: "bold 28px Arial",
            fill: "#e94560",
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

        // 分数和等级显示 - 样式优化
        this.scoreText = this.game.add.text(windowWidth / 2, 70, `分数: 0  等级: 1`, {
            font: "bold 20px Arial",
            fill: "#f8f8f8",
            align: "center",
            stroke: "#333",
            strokeThickness: 2,
            shadow: {
                offsetX: 1,
                offsetY: 1,
                color: "#000",
                blur: 3
            }
        });
        this.scoreText.anchor.set(0.5);

        // 创建下一个方块预览区域
        this.createNextBlockPreview();

        this.addControlButtons();
    }

    createNextBlockPreview() {
        const previewSize = 80; // 缩小预览区域大小
        const previewX = windowWidth - previewSize - 20; // 更靠右，减少右边距
        const previewY = 120;

        // 创建预览区域背景
        const previewBg = this.game.add.graphics(previewX - 10, previewY - 10);
        previewBg.beginFill(this.styles.previewBgColor, 0.8);
        previewBg.lineStyle(2, this.styles.gridColor, 0.6);
        previewBg.drawRoundedRect(0, 0, previewSize + 20, previewSize + 40, 8); // 圆角减小
        previewBg.endFill();

        // 预览标题 - 字体缩小
        this.nextBlockText = this.game.add.text(previewX + previewSize / 2, previewY - 5, "下一个", {
            font: "bold 14px Arial", // 字体缩小
            fill: "#e94560",
            align: "center"
        });
        this.nextBlockText.anchor.set(0.5);

        // 创建预览容器
        this.previewContainer = this.game.add.group();
        this.previewGraphics = this.game.add.graphics(0, 0);
        this.previewContainer.add(previewBg);
        this.previewContainer.add(this.previewGraphics);
        this.previewContainer.add(this.nextBlockText);
    }

    drawNextBlockPreview() {
        if (!this.nextShape || !this.previewGraphics) return;

        this.previewGraphics.clear();

        const previewSize = 80; // 与上面保持一致
        const previewX = windowWidth - previewSize - 20;
        const previewY = 140;
        const previewBlockSize = Math.min(15, previewSize / 4); // 进一步缩小方块大小

        // 计算方块在预览区域中的居中位置
        const shapeWidth = this.nextShape[0].length * previewBlockSize;
        const shapeHeight = this.nextShape.length * previewBlockSize;
        const startX = previewX + (previewSize - shapeWidth) / 2;
        const startY = previewY + (previewSize - shapeHeight) / 2;

        // 绘制下一个方块
        for (let i = 0; i < this.nextShape.length; i++) {
            for (let j = 0; j < this.nextShape[0].length; j++) {
                if (this.nextShape[i][j]) {
                    this.drawPreviewBlock(
                        startX + j * previewBlockSize,
                        startY + i * previewBlockSize,
                        previewBlockSize,
                        this.nextColor
                    );
                }
            }
        }

        // 添加预览方块的发光效果 - 线条更细
        this.previewGraphics.lineStyle(1, this.styles.blockGlow, 0.3);
        this.previewGraphics.drawRoundedRect(
            startX - 1,
            startY - 1,
            shapeWidth + 2,
            shapeHeight + 2,
            3
        );
    }

    drawPreviewBlock(x, y, size, color) {
        // 方块主体
        this.previewGraphics.beginFill(color);
        this.previewGraphics.drawRoundedRect(x, y, size - 1, size - 1, 3);
        this.previewGraphics.endFill();

        // 3D效果 - 高光
        this.previewGraphics.beginFill(0xffffff, 0.4);
        this.previewGraphics.drawRect(x + 1, y + 1, size - 6, 3);
        this.previewGraphics.drawRect(x + 1, y + 1, 3, size - 6);
        this.previewGraphics.endFill();

        // 3D效果 - 阴影
        this.previewGraphics.beginFill(0x000000, 0.3);
        this.previewGraphics.drawRect(x + size - 4, y + 3, 3, size - 6);
        this.previewGraphics.drawRect(x + 3, y + size - 4, size - 6, 3);
        this.previewGraphics.endFill();
    }

    generateNextBlock() {
        // 1. 随机索引
        const idx = Math.floor(Math.random() * this.shapes.length);
        // 2. 深度复制形状（避免引用共享）
        this.nextShape = this.shapes[idx].map(row => row.slice());
        // 3. 颜色也拷一份
        this.nextColor = this.colors[idx % this.colors.length];
        // 4. 更新预览
        this.drawNextBlockPreview();

    }

    spawnBlock() {
        if (!this.nextShape) {
            // 第一次启动
            this.generateNextBlock();
        }

        // 把“下一格”数据原封不动交给“当前格”
        this.curShape = this.nextShape.map(row => row.slice()); // 再深拷贝一次
        this.curColor = this.nextColor;
        this.curRow   = 0;
        this.curCol   = Math.floor((this.cols - this.curShape[0].length) / 2);

        // 立即为“下一格”生成新的，此时 cur 与 next 完全独立
        this.generateNextBlock();

        if (this.collide(this.curRow, this.curCol, this.curShape)) {
            this.gameOver();
            return;
        }

        this.drawBoard();
    }

    addControlButtons() {
        const btnSize = Math.floor(windowWidth * 0.13);
        const margin = Math.floor(windowWidth * 0.04);
        const totalWidth = btnSize * 4 + margin * 3;
        const startX = (windowWidth - totalWidth) / 2;
        const y = windowHeight - btnSize - 120;

        directions.forEach((name, idx) => {
            const btn = this.game.add.image(startX + idx * (btnSize + margin), y, name);
            btn.width = btn.height = btnSize;
            btn.inputEnabled = true;
            btn.input.useHandCursor = true;

            // 按钮动画效果
            btn.alpha = 0.9;
            btn.events.onInputOver.add(() => {
                this.game.add.tween(btn).to({ alpha: 1, scaleX: 1.1, scaleY: 1.1 }, 150, Phaser.Easing.Back.Out, true);
            });
            btn.events.onInputOut.add(() => {
                this.game.add.tween(btn).to({ alpha: 0.9, scaleX: 1, scaleY: 1 }, 150, Phaser.Easing.Back.Out, true);
            });
            btn.events.onInputDown.add(() => {
                this.createButtonRippleEffect(btn.x + btnSize / 2, btn.y + btnSize / 2);
                this.handleButtonAction(name);
            }, this);

            // 按钮发光效果
            const glow = this.game.add.graphics(btn.x, btn.y);
            glow.lineStyle(3, 0xffffff, 0.3);
            glow.drawRoundedRect(0, 0, btnSize, btnSize, 10);
            glow.alpha = 0.5;
        });
    }

    createButtonRippleEffect(x, y) {
        const ripple = this.game.add.graphics(x, y);
        ripple.lineStyle(2, 0xffffff, 0.8);
        ripple.drawCircle(0, 0, 10);

        this.game.add.tween(ripple.scale)
            .to({ x: 3, y: 3 }, 300, Phaser.Easing.Circular.Out, true);
        this.game.add.tween(ripple)
            .to({ alpha: 0 }, 300, Phaser.Easing.Circular.Out, true)
            .onComplete.add(() => ripple.destroy());
    }

    handleButtonAction(name) {
        switch (name) {
            case "left": this.moveBlock(-1); break;
            case "right": this.moveBlock(1); break;
            case "down": this.drop(); break;
            case "rotate": this.rotateBlock(); break;
        }
    }

    setupControls() {
        // 键盘控制
        this.cursors = this.game.input.keyboard.createCursorKeys();
        this.game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR).onDown.add(this.rotateBlock, this);

        // 触摸控制
        this.setupTouchControls();
    }

    setupTouchControls() {
        this.startX = 0; this.startY = 0;
        this.game.canvas.addEventListener('touchstart', this._ts = e => {
            if (e.touches.length === 1) {
                this.startX = e.touches[0].clientX;
                this.startY = e.touches[0].clientY;
            }
        });
        this.game.canvas.addEventListener('touchend', this._te = e => {
            if (e.changedTouches.length === 1) {
                const dx = e.changedTouches[0].clientX - this.startX;
                const dy = e.changedTouches[0].clientY - this.startY;
                if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
                    if (dx > 0) this.moveBlock(1);
                    else this.moveBlock(-1);
                } else if (Math.abs(dy) > 10) {
                    if (dy > 0) this.drop();
                    else this.rotateBlock();
                }
            }
        });
    }

    collide(row, col, shape) {
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[0].length; j++) {
                if (shape[i][j]) {
                    const r = row + i, c = col + j;
                    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols || this.board[r][c]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    mergeBlock() {
        for (let i = 0; i < this.curShape.length; i++) {
            for (let j = 0; j < this.curShape[0].length; j++) {
                if (this.curShape[i][j]) {
                    this.board[this.curRow + i][this.curCol + j] = this.curColor;
                }
            }
        }
    }

    drop() {
        if (!this.curShape || this.isClearing) return;

        if (!this.collide(this.curRow + 1, this.curCol, this.curShape)) {
            this.curRow++;
            this.drawBoard();
        } else {
            this.mergeBlock();
            this.clearLinesWithAnimation();
        }
    }

    clearLinesWithAnimation() {
        if (this.isClearing) return; // 防止重复进入
        this.isClearing = true;

        const linesToClear = [];
        for (let i = this.rows - 1; i >= 0; i--) {
            if (this.board[i].every(v => v)) linesToClear.push(i);
        }

        if (linesToClear.length > 0) {
            this.playClearAnimation(linesToClear);
            this.game.time.events.add(500, () => {
                this.performLineClear(linesToClear);
                this.isClearing = false; // 🔓 动画结束解锁
                this.spawnBlock();       // 只有这里调用一次
            });
        } else {
            this.isClearing = false;   // 无行可消也要解锁
            this.spawnBlock();
        }
    }

    playClearAnimation(lines) {
        // 创建闪烁效果
        lines.forEach(line => {
            for (let j = 0; j < this.cols; j++) {
                if (this.board[line][j]) {
                    this.createClearEffect(j, line);
                }
            }
        });

        // 屏幕震动效果
        this.game.world.x = 5;
        this.game.add.tween(this.game.world)
            .to({ x: 0 }, 200, Phaser.Easing.Bounce.Out, true);
    }

    createClearEffect(col, row) {
        const x = this.boardOffsetX + col * this.blockSize + this.blockSize / 2;
        const y = this.boardOffsetY + row * this.blockSize + this.blockSize / 2;

        // 创建粒子效果
        for (let i = 0; i < 4; i++) {
            const particle = this.game.add.graphics(x, y);
            const size = 2 + Math.random() * 4;
            particle.beginFill(this.board[row][col]);
            particle.drawRect(-size / 2, -size / 2, size, size);
            particle.endFill();

            const angle = Math.random() * Math.PI * 2;
            const distance = 10 + Math.random() * 20;

            this.game.add.tween(particle)
                .to({
                    x: x + Math.cos(angle) * distance,
                    y: y + Math.sin(angle) * distance,
                    alpha: 0
                }, 400, Phaser.Easing.Circular.Out, true)
                .onComplete.add(() => particle.destroy());
        }
    }


    performLineClear(lines) {
        let totalLines = 0;

        lines.sort((a, b) => a - b).forEach(line => {
            this.board.splice(line, 1);
            this.board.unshift(Array(this.cols).fill(0));
            totalLines++;
        });

        if (totalLines > 0) {
            this.updateScore(totalLines);
        }

        this.drawBoard();

        // 在消除完成后生成新方块
        this.spawnBlock();
    }


    updateScore(linesCleared) {
        const points = [0, 100, 300, 500, 800][linesCleared] || 0;
        this.score += points;
        this.level = 1 + Math.floor(this.score / 1000);

        // 更新文本动画
        this.scoreText.text = `分数: ${this.score}  等级: ${this.level}`;
        this.game.add.tween(this.scoreText.scale)
            .to({ x: 1.2, y: 1.2 }, 100, Phaser.Easing.Back.Out, true)
            .to({ x: 1, y: 1 }, 100, Phaser.Easing.Back.In, true);

        // 更新下落速度
        this.updateDropSpeed();
    }

    updateDropSpeed() {
        this.game.time.events.remove(this.dropTimer);
        this.dropTimer = this.game.time.events.loop(
            levelSpeeds[this.level] || 300,
            this.drop,
            this
        );
    }

    moveBlock(dir) {
        if (!this.curShape) return;
        const newCol = this.curCol + dir;
        if (!this.collide(this.curRow, newCol, this.curShape)) {
            this.curCol = newCol;
            this.drawBoard();
        }
    }

    rotateBlock() {
        if (!this.curShape) return;

        // 旋转动画
        this.createRotationEffect();

        const newShape = [];
        for (let j = 0; j < this.curShape[0].length; j++) {
            newShape[j] = [];
            for (let i = this.curShape.length - 1; i >= 0; i--) {
                newShape[j].push(this.curShape[i][j]);
            }
        }

        let newCol = this.curCol;
        let newRow = this.curRow;

        // 边界修正
        if (newCol + newShape[0].length > this.cols) newCol = this.cols - newShape[0].length;
        if (newCol < 0) newCol = 0;
        if (newRow + newShape.length > this.rows) newRow = this.rows - newShape.length;
        if (newRow < 0) newRow = 0;

        if (!this.collide(newRow, newCol, newShape)) {
            this.curShape = newShape;
            this.curCol = newCol;
            this.curRow = newRow;
            this.drawBoard();
        }
    }

    createRotationEffect() {
        const centerX = this.boardOffsetX + (this.curCol + this.curShape[0].length / 2) * this.blockSize;
        const centerY = this.boardOffsetY + (this.curRow + this.curShape.length / 2) * this.blockSize;

        const effect = this.game.add.graphics(centerX, centerY);
        effect.lineStyle(2, 0xffffff, 0.8);
        effect.drawCircle(0, 0, 20);

        this.game.add.tween(effect.scale)
            .to({ x: 2, y: 2 }, 200, Phaser.Easing.Circular.Out, true);
        this.game.add.tween(effect)
            .to({ alpha: 0 }, 200, Phaser.Easing.Circular.Out, true)
            .onComplete.add(() => effect.destroy());
    }

    drawBoard() {
        if (this.graphics) this.graphics.destroy();
        this.graphics = this.game.add.graphics(0, 0);

        // 绘制游戏板背景
        this.graphics.beginFill(this.styles.boardColor, 0.8);
        this.graphics.drawRoundedRect(
            this.boardOffsetX - 5,
            this.boardOffsetY - 5,
            this.cols * this.blockSize + 10,
            this.rows * this.blockSize + 10,
            10
        );
        this.graphics.endFill();

        // 绘制已落下的方块（带阴影效果）
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                if (this.board[i][j]) {
                    this.drawBlock(j, i, this.board[i][j], true);
                }
            }
        }

        // 绘制当前方块（带发光效果）
        if (this.curShape) {
            for (let i = 0; i < this.curShape.length; i++) {
                for (let j = 0; j < this.curShape[0].length; j++) {
                    if (this.curShape[i][j]) {
                        this.drawBlock(this.curCol + j, this.curRow + i, this.curColor, false);
                    }
                }
            }
        }
    }

    drawBlock(col, row, color, isStatic) {
        const x = this.boardOffsetX + col * this.blockSize;
        const y = this.boardOffsetY + row * this.blockSize;
        const size = this.blockSize - 2;

        // 方块主体
        this.graphics.beginFill(color);
        this.graphics.drawRoundedRect(x + 1, y + 1, size, size, 4);
        this.graphics.endFill();

        // 3D效果 - 高光
        this.graphics.beginFill(0xffffff, 0.3);
        this.graphics.drawRect(x + 2, y + 2, size - 8, 4);
        this.graphics.drawRect(x + 2, y + 2, 4, size - 8);
        this.graphics.endFill();

        // 3D效果 - 阴影
        this.graphics.beginFill(0x000000, 0.3);
        this.graphics.drawRect(x + size - 6, y + 6, 4, size - 8);
        this.graphics.drawRect(x + 6, y + size - 6, size - 8, 4);
        this.graphics.endFill();

        // 当前方块的发光效果
        if (!isStatic) {
            this.graphics.lineStyle(2, this.styles.blockGlow, 0.5);
            this.graphics.drawRoundedRect(x, y, this.blockSize, this.blockSize, 4);
        }
    }

    startGameLoop() {
        this.dropTimer = this.game.time.events.loop(levelSpeeds[this.level] || 300, this.drop, this);
    }

    gameOver() {
        this.game.time.events.remove(this.dropTimer);
        this.createGameOverEffect();

        this.game.time.events.add(1000, () => {
            wx.showModal && wx.showModal({
                title: '🎮 游戏结束',
                content: `最终分数: ${this.score}`,
                showCancel: false,
                confirmText: '再玩一次',
                confirmColor: '#e94560'
            });
        }, this);
    }

    createGameOverEffect() {
        // 创建游戏结束的粒子效果
        for (let i = 0; i < 30; i++) {
            this.game.time.events.add(i * 50, () => {
                const x = this.boardOffsetX + Math.random() * this.cols * this.blockSize;
                const y = this.boardOffsetY + Math.random() * this.rows * this.blockSize;
                this.createExplosionParticle(x, y);
            }, this);
        }
    }

    createExplosionParticle(x, y) {
        const particle = this.game.add.graphics(x, y);
        const size = 3 + Math.random() * 6;
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];

        particle.beginFill(color);
        particle.drawCircle(0, 0, size);
        particle.endFill();

        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 100;

        this.game.add.tween(particle)
            .to({
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                alpha: 0
            }, 800, Phaser.Easing.Circular.Out, true)
            .onComplete.add(() => particle.destroy());
    }

    cleanupGame() {
        if (this._ts) this.game.canvas.removeEventListener('touchstart', this._ts);
        if (this._te) this.game.canvas.removeEventListener('touchend', this._te);
        if (this.dropTimer) this.game.time.events.remove(this.dropTimer);
    }

    update() {
        if (this.isClearing) return; // 消行期间忽略键盘
        if (this.cursors.left.justDown) this.moveBlock(-1);
        if (this.cursors.right.justDown) this.moveBlock(1);
        if (this.cursors.down.justDown) this.drop();

    }

    render() {
        // 可选的调试信息
    }
}