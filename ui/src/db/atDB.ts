import chats from "./tables/tblChats";
import dic from "./tables/tblDic";
import files from "./tables/tblFiles";
import group from "./tables/tblGroup";
import log from "./tables/tblLog";
import messages from "./tables/tblMessages";
import news from "./tables/tblNews";
import perUserStats from "./tables/tblPerUserStats";
import sampleQuestions from "./tables/tblSampleQuestions";
import user from "./tables/tblUser";
import sharedFiles from "./tables/tblSharedFiles";

const atDB =  {
  log,
  dic,
  messages,
  chats,
  files,
  user,
  group,
  sampleQuestions,
  perUserStats,
  news,
  sharedFiles
};

export default atDB