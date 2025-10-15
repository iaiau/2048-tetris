export default {
  initGame(game){ // 小游戏初始化方法
   game.state.start("GameState");
  },
  getStorageSync(key,def){
    return wx.getStorageSync(key) ? wx.getStorageSync(key) : def;
  },
  setStorageSync(key,value){
    wx.setStorageSync(key, value);
  }
  
}
