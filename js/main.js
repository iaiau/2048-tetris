import Phaser from "./libs/phaser";
import GameState from "./states/gameState";
import TetrisState from "./states/tetrisState";
import _2048State from "./states/2048State";
import utils from "./utils/utils";

class Game extends Phaser.Game {
  constructor() {
    let {
      windowWidth,
      windowHeight
    } = wx.getSystemInfoSync();
    const conf = {
      width: windowWidth,
      height: windowHeight,
      canvas: canvas,
      renderer: Phaser.WEBGL,
      transparent: false,
      antialias: false
    }
    super(conf);
    // 添加小游戏state
    this.state.add("GameState", GameState);
    this.state.add("TetrisState",TetrisState);
    this.state.add("_2048State",_2048State);
  }
}

var game = new Game();
utils.initGame(game);
