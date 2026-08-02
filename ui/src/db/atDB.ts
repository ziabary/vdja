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
import sharedFileRequests from "./tables/tblSharedFileRequests";
import widgets from "./tables/tblWidgets";
import widgetOperators from "./tables/tblWidgetOperators";
import widgetSessions from "./tables/tblWidgetSessions";
import widgetHumanReplies from "./tables/tblWidgetHumanReplies";

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
  sharedFiles,
  sharedFileRequests,
  widgets,
  widgetOperators,
  widgetSessions,
  widgetHumanReplies
};

export default atDB