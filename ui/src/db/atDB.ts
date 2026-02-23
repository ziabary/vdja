import log from "./tables/tblLog"
import dic from "./tables/tblDic"
import messages from "./tables/tblMessages"
import chats from "./tables/tblChats"
import files from "./tables/tblFiles"
import user from "./tables/tblUser"
import group from "./tables/tblGroup"
import sampleQuestions from "./tables/tblSampleQuestions"
import perUserStats from "./tables/tblPerUserStats"

const atDB =  {
  log,
  dic,
  messages,
  chats,
  files,
  user,
  group,
  sampleQuestions,
  perUserStats
};

export default atDB