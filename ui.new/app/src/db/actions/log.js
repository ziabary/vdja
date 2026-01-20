const {getDB} = require("../index")

module.exports = {
  add: (userToken, action, info, msgLen, resultCode = undefined, result = undefined) => getDB().then(db => {
    return db('tblLogs').insert({
      logBy_usrID: db('tblUser')
      .select('usrID')
      .where('usrKeyHash', userToken || null)
      .first(),
      logAction: action,
      logInfo: JSON.stringify(info),
      logMsgLen: msgLen,
      logResultCode: resultCode || null,
      logResult: JSON.stringify(result || null)
    });   
  })
} 