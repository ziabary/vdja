const {getDB} = require("..")

safeJsonParse = (txt)=>{
  try{
    return JSON.parse(txt)
  }catch{
    return null
  }
}
module.exports = {
  lookup: (phrase) => getDB().then(db => db('tblMultiDic').select("*").where('dicWord', phrase).first())
                             .then(dic=>dic && ({
                                  phrase: dic.dicWord, 
                                  translations: safeJsonParse(dic.dicTranslation),
                                  synonyms: safeJsonParse(dic.dicSynonyms),
                                  antonyms: safeJsonParse(dic.dicAntonyms),
                                  relExp: safeJsonParse(dic.RelExp),
                                  relWords: safeJsonParse(dic.dicRelWord),
                                  pronunciations: safeJsonParse(dic.dicPronunciation),
                                  examples: safeJsonParse(dic.dicPronunciation),
                                  extra: safeJsonParse(dic.dicExtra)
                                })),   
  count: ()=>getDB().then(db => db('tblMultiDic').count('* as count').first()).then(res=>res.count),   
}