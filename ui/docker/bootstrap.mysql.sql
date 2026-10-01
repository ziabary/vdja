-- Vadja / TargomanLLM fresh-install bootstrap. MySQL 8.4.
-- Run with the mysql client as an existing database administrator (without --force).
-- Replace CHANGE_ME_ROOT_PASSWORD below before running.
-- Requires mysql_native_password=ON in mysqld config before bootstrap.
-- Creates/resets remote root with the deprecated native plugin for older clients.
-- Creates root@'%' only if absent; an existing account keeps its password.
-- Fresh database only: stops if TargomanLLM already contains tables.
-- Sources: ui/db/db.sql + ui/src/db/schema/10..19 and runtime group IDs.
-- Includes system seeds, not production records or the optional dictionary corpus.
-- MySQL root is a database account, not an application login.

CREATE DATABASE IF NOT EXISTS TargomanLLM CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE TargomanLLM;
DELIMITER //
CREATE PROCEDURE bootstrap_assert_empty()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE()) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TargomanLLM is not empty. Use migrations for an existing database.';
  END IF;
END//
DELIMITER ;
CALL bootstrap_assert_empty();
DROP PROCEDURE bootstrap_assert_empty;

SET NAMES utf8mb4;
SET @bootstrap_old_fk = @@FOREIGN_KEY_CHECKS;
SET @bootstrap_old_mode = @@SQL_MODE;
SET @bootstrap_old_tz = @@TIME_ZONE;
SET FOREIGN_KEY_CHECKS = 0;
SET TIME_ZONE = '+00:00';
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE TABLE `tblChats` (
  `chtID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `chtKey` char(32) COLLATE utf8mb4_unicode_520_ci NOT NULL DEFAULT '',
  `chtOwner_usrID` bigint unsigned NOT NULL,
  `chtService` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci NOT NULL DEFAULT '',
  `chtTitle` varchar(100) COLLATE utf8mb4_unicode_520_ci DEFAULT NULL,
  `chtLast_msgID` bigint unsigned DEFAULT NULL,
  `chtCreatedAt` timestamp NOT NULL DEFAULT (now()),
  `chtStatus` enum('Active','Removed') COLLATE utf8mb4_unicode_520_ci NOT NULL DEFAULT 'Active',
  PRIMARY KEY (`chtID`),
  UNIQUE KEY `chtHash` (`chtKey`,`chtOwner_usrID`,`chtService`) USING BTREE,
  KEY `chtCreatedAt` (`chtCreatedAt`),
  KEY `chtStatus` (`chtStatus`),
  KEY `FK_tblChats_tblMessages` (`chtLast_msgID`),
  KEY `FK_tblChats_tblUser` (`chtOwner_usrID`) USING BTREE,
  KEY `chtService` (`chtService`),
  CONSTRAINT `FK_tblChats_tblMessages` FOREIGN KEY (`chtLast_msgID`) REFERENCES `tblMessages` (`msgID`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `FK_tblChats_tblUser` FOREIGN KEY (`chtOwner_usrID`) REFERENCES `tblUser` (`usrID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE TABLE `tblFiles` (
  `filID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `filOwner_usrID` bigint unsigned NOT NULL,
  `filKey` char(32) COLLATE utf8mb4_unicode_520_ci NOT NULL DEFAULT '' COMMENT 'UUID',
  `filService` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci NOT NULL DEFAULT '',
  `filName` varchar(100) COLLATE utf8mb4_unicode_520_ci NOT NULL,
  `filSize` bigint unsigned NOT NULL,
  `filChunkCount` int unsigned NOT NULL,
  `filUploadedAt` timestamp NOT NULL DEFAULT (now()),
  `filStatus` enum('Active','Removed','Processing') COLLATE utf8mb4_unicode_520_ci NOT NULL DEFAULT 'Processing',
  PRIMARY KEY (`filID`),
  UNIQUE KEY `filOwner_usrID_filKey` (`filOwner_usrID`,`filKey`,`filService`) USING BTREE,
  KEY `filKey` (`filKey`),
  KEY `filUploadedAt` (`filUploadedAt`),
  KEY `filStatus` (`filStatus`),
  KEY `filService` (`filService`),
  CONSTRAINT `FK_tblFile_tblUser` FOREIGN KEY (`filOwner_usrID`) REFERENCES `tblUser` (`usrID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE TABLE `tblGroup` (
  `grpID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `grpName` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `grpPrivs` json DEFAULT NULL,
  `grpStatus` enum('Active','Removed','Banned') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Active',
  PRIMARY KEY (`grpID`),
  KEY `grpStatus` (`grpStatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tblLogs` (
  `logID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `logBy_usrKey` char(32) DEFAULT NULL COMMENT 'Intentionally no FK',
  `logAction` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '0',
  `logInfo` json NOT NULL,
  `logMsgLen` int DEFAULT (0),
  `logResultCode` smallint DEFAULT NULL,
  `logResult` json DEFAULT NULL,
  `logCreatedAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`logID`),
  KEY `logCreatedAt` (`logCreatedAt`),
  KEY `logAction` (`logAction`),
  KEY `logMsgLen` (`logMsgLen`),
  KEY `FK_tblLogs_tblUser` (`logBy_usrKey`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tblMessages` (
  `msgID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `msgKey` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '0',
  `msgRole` enum('user','assistant') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `msgRelated_chtID` bigint unsigned NOT NULL,
  `msgContent` text NOT NULL,
  `msgOpinion` char(1) DEFAULT NULL,
  `msgCreatedAt` timestamp NOT NULL DEFAULT (now()),
  `msgStatus` enum('Finished','Stopped') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`msgID`),
  UNIQUE KEY `msgKey` (`msgKey`,`msgRole`) USING BTREE,
  KEY `msgRole` (`msgRole`),
  KEY `msgCreatedAt` (`msgCreatedAt`),
  KEY `FK_tblMessage_tblChats` (`msgRelated_chtID`) USING BTREE,
  KEY `msgOpinion` (`msgOpinion`),
  KEY `msgStatus` (`msgStatus`),
  CONSTRAINT `FK_tblMessage_tblChats` FOREIGN KEY (`msgRelated_chtID`) REFERENCES `tblChats` (`chtID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tblMultiDic` (
  `dicID` int unsigned NOT NULL AUTO_INCREMENT,
  `dicSource` varchar(10) COLLATE utf8mb4_cs_0900_ai_ci DEFAULT NULL,
  `dicLang` char(2) COLLATE utf8mb4_cs_0900_ai_ci NOT NULL,
  `dicWord` varchar(100) COLLATE utf8mb4_cs_0900_ai_ci NOT NULL,
  `dicTranslation` longtext COLLATE utf8mb4_cs_0900_ai_ci,
  `dicSynonyms` longtext COLLATE utf8mb4_cs_0900_ai_ci,
  `dicAntonyms` longtext COLLATE utf8mb4_cs_0900_ai_ci,
  `dicRelExp` longtext COLLATE utf8mb4_cs_0900_ai_ci,
  `dicRelWord` longtext COLLATE utf8mb4_cs_0900_ai_ci,
  `dicPronunciation` longtext COLLATE utf8mb4_cs_0900_ai_ci,
  `dicExamples` longtext COLLATE utf8mb4_cs_0900_ai_ci,
  `dicExtra` longtext COLLATE utf8mb4_cs_0900_ai_ci,
  PRIMARY KEY (`dicID`),
  KEY `dicLang` (`dicLang`),
  KEY `dicSource` (`dicSource`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_cs_0900_ai_ci;

CREATE TABLE `tblNews` (
  `newsVDBID` char(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `newsLink` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `newsCreatedAt` timestamp NOT NULL DEFAULT (now()),
  `newsStatus` enum('Active','Removed') NOT NULL DEFAULT 'Active',
  PRIMARY KEY (`newsVDBID`),
  KEY `newsCreatedAt` (`newsCreatedAt`),
  KEY `newsStatus` (`newsStatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tblPerUserStats` (
  `pusID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `pusAssigned_usrID` bigint unsigned NOT NULL,
  `pusService` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `pusTotalFiles` int unsigned NOT NULL DEFAULT (0),
  `pusActiveFiles` mediumint unsigned NOT NULL DEFAULT (0),
  `pusTotalSize` bigint unsigned NOT NULL DEFAULT (0),
  `pusActiveSize` bigint unsigned NOT NULL DEFAULT (0),
  `pusTotalChats` bigint unsigned NOT NULL DEFAULT (0),
  `pusUsedTokens` bigint unsigned NOT NULL DEFAULT (0),
  PRIMARY KEY (`pusID`),
  UNIQUE KEY `pusAssigned_usrID_pusService` (`pusAssigned_usrID`,`pusService`),
  KEY `pusService` (`pusService`),
  CONSTRAINT `FK_tblPerUserStats_tblUser` FOREIGN KEY (`pusAssigned_usrID`) REFERENCES `tblUser` (`usrID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tblSampleQuestions` (
  `smqID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `smqAssigned_filID` bigint unsigned NOT NULL,
  `smqQuestion` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`smqID`),
  KEY `FK_tblSampleQuestions_tblFiles` (`smqAssigned_filID`) USING BTREE,
  CONSTRAINT `FK_tblSampleQuestions_tblFiles` FOREIGN KEY (`smqAssigned_filID`) REFERENCES `tblFiles` (`filID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tblSharedFileRequests` (
  `sfrID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sfrBy_usrID` bigint unsigned NOT NULL,
  `sfrUserOnBale` varchar(50) DEFAULT NULL,
  `sfrCategory` varchar(50) NOT NULL DEFAULT '',
  `sfrLink` mediumtext NOT NULL,
  `sfrDescription` text NOT NULL,
  `sfrCreatedAt` timestamp NOT NULL DEFAULT (now()),
  `sfrStatus` enum('New','Downloading','Downloaded','Discarded') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'New',
  PRIMARY KEY (`sfrID`),
  KEY `sfrStatus` (`sfrStatus`),
  KEY `FK__tblUser` (`sfrBy_usrID`),
  KEY `sfrCreatedAt` (`sfrCreatedAt`),
  CONSTRAINT `FK__tblUser` FOREIGN KEY (`sfrBy_usrID`) REFERENCES `tblUser` (`usrID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tblSharedFiles` (
  `shfID` int unsigned NOT NULL AUTO_INCREMENT,
  `shfKey` varchar(50) NOT NULL,
  `shfPath` varchar(1000) NOT NULL,
  `shfTotalDownloads` int unsigned NOT NULL DEFAULT '0',
  `shfStatus` enum('Active','Banned') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'Active',
  `shfCreatedAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`shfID`),
  UNIQUE KEY `shfKey` (`shfKey`),
  KEY `shfCreatedAt` (`shfCreatedAt`),
  KEY `shfTotalDownloads` (`shfTotalDownloads`),
  KEY `shfStatus` (`shfStatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tblSharedFilesDownloads` (
  `sfdID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sfdBy_usrID` bigint unsigned NOT NULL,
  `sfdOn_shfID` int unsigned NOT NULL,
  `sfdToken` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `sfdCreatedAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`sfdID`) USING BTREE,
  UNIQUE KEY `sfdToken` (`sfdToken`),
  KEY `FK_tblSharedFilesDownloads_tblUser` (`sfdBy_usrID`),
  KEY `FK_tblSharedFilesDownloads_tblSharedFiles` (`sfdOn_shfID`),
  CONSTRAINT `FK_tblSharedFilesDownloads_tblSharedFiles` FOREIGN KEY (`sfdOn_shfID`) REFERENCES `tblSharedFiles` (`shfID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_tblSharedFilesDownloads_tblUser` FOREIGN KEY (`sfdBy_usrID`) REFERENCES `tblUser` (`usrID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tblUser` (
  `usrID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `usrName` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `usrKey` char(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `usrEmail` varchar(50) DEFAULT NULL,
  `usrMobile` varchar(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `usrOpenID` varchar(255) DEFAULT NULL,
  `usrAssigned_grpID` bigint unsigned NOT NULL,
  `usrSpecialPrivs` json DEFAULT NULL,
  `usrRefreshHash` mediumtext,
  `usrOTP` varchar(5) DEFAULT NULL,
  `usrLasLogin` timestamp NOT NULL DEFAULT (now()),
  `usrLastLogout` timestamp NULL DEFAULT NULL,
  `usrCreatedAt` timestamp NOT NULL DEFAULT (now()),
  `usrStatus` enum('Active','Removed','Banned') NOT NULL DEFAULT 'Active',
  PRIMARY KEY (`usrID`),
  UNIQUE KEY `usrKeyHash` (`usrKey`) USING BTREE,
  UNIQUE KEY `usrEmail` (`usrEmail`),
  UNIQUE KEY `usrMobile` (`usrMobile`),
  UNIQUE KEY `usrOpenID` (`usrOpenID`),
  KEY `usrLasLogin` (`usrLasLogin`),
  KEY `usrCreatedAt` (`usrCreatedAt`),
  KEY `usrName` (`usrName`),
  KEY `usrLastLogout` (`usrLastLogout`),
  KEY `usrStatus` (`usrStatus`),
  KEY `FK_tblUser_tblGroup` (`usrAssigned_grpID`),
  CONSTRAINT `FK_tblUser_tblGroup` FOREIGN KEY (`usrAssigned_grpID`) REFERENCES `tblGroup` (`grpID`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- 10_alter_tblUser_profile.cjs
alter table `tblUser` add `usrUsername` varchar(32) null, add `usrAvatar` longtext null, add `usrOrganization` varchar(100) null, add `usrTitle` varchar(100) null;
alter table `tblUser` add unique `usrUsername_unique`(`usrUsername`);
alter table `tblUser` add index `idx_tblUser_usrUsername`(`usrUsername`);

-- 11_tblWidgets.cjs
CREATE TABLE `tblWidgets` (
  `wgtID` bigint unsigned not null auto_increment primary key,
  `wgtKey` varchar(32) not null,
  `wgtOwner_usrID` bigint unsigned not null,
  `wgtRuntime_usrID` bigint unsigned not null,
  `wgtInternalName` varchar(100) not null,
  `wgtTargetOrigin` varchar(255) not null default '',
  `wgtPublishedOrigin` varchar(255) null,
  `wgtDraftConfig` json not null,
  `wgtPublishedConfig` json null,
  `wgtDraftVersion` int unsigned not null default '1',
  `wgtPublishedVersion` int unsigned not null default '0',
  `wgtStatus` varchar(20) not null default 'Draft',
  `wgtCreatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `wgtUpdatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `wgtPublishedAt` timestamp null,
  `wgtLastTestAt` timestamp null
);
alter table `tblWidgets` add unique `wgtKey_unique`(`wgtKey`);
alter table `tblWidgets` add unique `wgtRuntime_usrID_unique`(`wgtRuntime_usrID`);
alter table `tblWidgets` add index `idx_tblWidgets_owner_status`(`wgtOwner_usrID`, `wgtStatus`);
alter table `tblWidgets` add index `idx_tblWidgets_origin`(`wgtTargetOrigin`);
alter table `tblWidgets` add index `idx_tblWidgets_published_origin`(`wgtPublishedOrigin`);
alter table `tblWidgets` add index `idx_tblWidgets_updated`(`wgtUpdatedAt`);
alter table `tblWidgets` add constraint `FK_tblWidgets_owner` foreign key (`wgtOwner_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete RESTRICT;
alter table `tblWidgets` add constraint `FK_tblWidgets_runtime` foreign key (`wgtRuntime_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete RESTRICT;

-- 12_tblWidgetOperators.cjs
CREATE TABLE `tblWidgetOperators` (
  `wopID` bigint unsigned not null auto_increment primary key,
  `wopWidget_wgtID` bigint unsigned not null,
  `wopOperator_usrID` bigint unsigned not null,
  `wopRole` varchar(20) not null default 'Operator',
  `wopStatus` varchar(20) not null default 'Active',
  `wopCreatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `wopUpdatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblWidgetOperators` add unique `uq_widget_operator`(`wopWidget_wgtID`, `wopOperator_usrID`);
alter table `tblWidgetOperators` add index `idx_widget_operator_user`(`wopOperator_usrID`, `wopStatus`);
alter table `tblWidgetOperators` add constraint `FK_tblWidgetOperators_widget` foreign key (`wopWidget_wgtID`) references `tblWidgets` (`wgtID`) on update CASCADE on delete CASCADE;
alter table `tblWidgetOperators` add constraint `FK_tblWidgetOperators_user` foreign key (`wopOperator_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete CASCADE;

-- 13_tblWidgetSessions.cjs
CREATE TABLE `tblWidgetSessions` (
  `wssID` bigint unsigned not null auto_increment primary key,
  `wssKey` varchar(32) not null,
  `wssWidget_wgtID` bigint unsigned not null,
  `wssChat_chtID` bigint unsigned not null,
  `wssMode` varchar(12) not null default 'Public',
  `wssStatus` varchar(20) not null default 'Bot',
  `wssVisitorName` varchar(100) null,
  `wssVisitorContact` varchar(150) null,
  `wssCategory` varchar(32) null,
  `wssConfidence` decimal(5, 2) null,
  `wssHandoffReason` text null,
  `wssAssigned_usrID` bigint unsigned null,
  `wssOrigin` varchar(255) null,
  `wssCreatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `wssUpdatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `wssHandoffAt` timestamp null,
  `wssAssignedAt` timestamp null,
  `wssFirstResponseAt` timestamp null,
  `wssResolvedAt` timestamp null
);
alter table `tblWidgetSessions` add unique `wssKey_unique`(`wssKey`);
alter table `tblWidgetSessions` add unique `wssChat_chtID_unique`(`wssChat_chtID`);
alter table `tblWidgetSessions` add index `idx_widget_sessions_queue`(`wssWidget_wgtID`, `wssStatus`, `wssUpdatedAt`);
alter table `tblWidgetSessions` add index `idx_widget_sessions_assigned`(`wssAssigned_usrID`, `wssStatus`);
alter table `tblWidgetSessions` add index `idx_widget_sessions_analytics`(`wssWidget_wgtID`, `wssMode`, `wssCreatedAt`);
alter table `tblWidgetSessions` add constraint `FK_tblWidgetSessions_widget` foreign key (`wssWidget_wgtID`) references `tblWidgets` (`wgtID`) on update CASCADE on delete CASCADE;
alter table `tblWidgetSessions` add constraint `FK_tblWidgetSessions_chat` foreign key (`wssChat_chtID`) references `tblChats` (`chtID`) on update CASCADE on delete CASCADE;
alter table `tblWidgetSessions` add constraint `FK_tblWidgetSessions_assigned` foreign key (`wssAssigned_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete SET NULL;

-- 14_tblWidgetHumanReplies.cjs
CREATE TABLE `tblWidgetHumanReplies` (
  `whrID` bigint unsigned not null auto_increment primary key,
  `whrSession_wssID` bigint unsigned not null,
  `whrOperator_usrID` bigint unsigned not null,
  `whrMessage_msgID` bigint unsigned not null,
  `whrCreatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblWidgetHumanReplies` add unique `whrMessage_msgID_unique`(`whrMessage_msgID`);
alter table `tblWidgetHumanReplies` add index `idx_widget_human_operator`(`whrOperator_usrID`, `whrCreatedAt`);
alter table `tblWidgetHumanReplies` add index `idx_widget_human_session`(`whrSession_wssID`, `whrCreatedAt`);
alter table `tblWidgetHumanReplies` add constraint `FK_tblWidgetHumanReplies_session` foreign key (`whrSession_wssID`) references `tblWidgetSessions` (`wssID`) on update CASCADE on delete CASCADE;
alter table `tblWidgetHumanReplies` add constraint `FK_tblWidgetHumanReplies_operator` foreign key (`whrOperator_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete CASCADE;
alter table `tblWidgetHumanReplies` add constraint `FK_tblWidgetHumanReplies_message` foreign key (`whrMessage_msgID`) references `tblMessages` (`msgID`) on update CASCADE on delete CASCADE;

-- 15_create_crm_workspace.cjs
CREATE TABLE `tblCRMWorkspaces` (
  `crwID` bigint unsigned not null auto_increment primary key,
  `crwKey` varchar(32) not null,
  `crwName` varchar(120) not null,
  `crwOwner_usrID` bigint unsigned not null,
  `crwCurrency` varchar(16) not null default 'تومان',
  `crwSettings` json null,
  `crwStatus` varchar(16) not null default 'Active',
  `crwCreatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `crwUpdatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblCRMWorkspaces` add unique `uq_crw_key`(`crwKey`);
alter table `tblCRMWorkspaces` add index `idx_crw_owner_status`(`crwOwner_usrID`, `crwStatus`);
alter table `tblCRMWorkspaces` add constraint `fk_crw_owner` foreign key (`crwOwner_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete RESTRICT;
CREATE TABLE `tblCRMMembers` (
  `crmID` bigint unsigned not null auto_increment primary key,
  `crmWorkspace_crwID` bigint unsigned not null,
  `crmUser_usrID` bigint unsigned not null,
  `crmRole` varchar(20) not null default 'Sales',
  `crmStatus` varchar(16) not null default 'Active',
  `crmCreatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `crmUpdatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblCRMMembers` add unique `uq_crm_workspace_user`(`crmWorkspace_crwID`, `crmUser_usrID`);
alter table `tblCRMMembers` add index `idx_crm_user_status`(`crmUser_usrID`, `crmStatus`);
alter table `tblCRMMembers` add constraint `fk_crm_workspace` foreign key (`crmWorkspace_crwID`) references `tblCRMWorkspaces` (`crwID`) on update CASCADE on delete CASCADE;
alter table `tblCRMMembers` add constraint `fk_crm_user` foreign key (`crmUser_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete RESTRICT;
CREATE TABLE `tblCRMProducts` (
  `crpID` bigint unsigned not null auto_increment primary key,
  `crpKey` varchar(32) not null,
  `crpWorkspace_crwID` bigint unsigned not null,
  `crpCode` varchar(64) not null,
  `crpName` varchar(180) not null,
  `crpShortName` varchar(100) not null,
  `crpType` varchar(20) not null default 'Software',
  `crpCategory` varchar(150) null,
  `crpIcon` varchar(64) null,
  `crpPrice` decimal(20, 0) not null default '0',
  `crpDescription` text null,
  `crpStatus` varchar(16) not null default 'Active',
  `crpCreatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `crpUpdatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblCRMProducts` add unique `uq_crp_key`(`crpKey`);
alter table `tblCRMProducts` add unique `uq_crp_workspace_code`(`crpWorkspace_crwID`, `crpCode`);
alter table `tblCRMProducts` add index `idx_crp_workspace_status_type`(`crpWorkspace_crwID`, `crpStatus`, `crpType`);
alter table `tblCRMProducts` add constraint `fk_crp_workspace` foreign key (`crpWorkspace_crwID`) references `tblCRMWorkspaces` (`crwID`) on update CASCADE on delete CASCADE;

-- 16_create_crm_customers.cjs
CREATE TABLE `tblCRMCustomers` (
  `crcID` bigint unsigned not null auto_increment primary key,
  `crcKey` varchar(32) not null,
  `crcWorkspace_crwID` bigint unsigned not null,
  `crcOwner_usrID` bigint unsigned null,
  `crcName` varchar(180) not null,
  `crcShort` varchar(16) null,
  `crcIndustry` varchar(120) null,
  `crcCity` varchar(80) null,
  `crcTier` varchar(40) null,
  `crcHealth` int unsigned not null default '75',
  `crcLifetimeValue` decimal(20, 0) not null default '0',
  `crcAnnualRevenue` decimal(20, 0) not null default '0',
  `crcLastInteraction` timestamp null,
  `crcNextAction` text null,
  `crcNextActionDue` timestamp null,
  `crcRenewalDate` timestamp null,
  `crcTags` json null,
  `crcAISummary` text null,
  `crcStatus` varchar(16) not null default 'Active',
  `crcCreatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `crcUpdatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblCRMCustomers` add unique `uq_crc_key`(`crcKey`);
alter table `tblCRMCustomers` add index `idx_crc_workspace_status`(`crcWorkspace_crwID`, `crcStatus`);
alter table `tblCRMCustomers` add index `idx_crc_owner_status`(`crcOwner_usrID`, `crcStatus`);
alter table `tblCRMCustomers` add index `idx_crc_name`(`crcName`);
alter table `tblCRMCustomers` add constraint `fk_crc_workspace` foreign key (`crcWorkspace_crwID`) references `tblCRMWorkspaces` (`crwID`) on update CASCADE on delete CASCADE;
alter table `tblCRMCustomers` add constraint `fk_crc_owner` foreign key (`crcOwner_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete SET NULL;
CREATE TABLE `tblCRMContacts` (
  `ccoID` bigint unsigned not null auto_increment primary key,
  `ccoKey` varchar(32) not null,
  `ccoCustomer_crcID` bigint unsigned not null,
  `ccoName` varchar(150) not null,
  `ccoTitle` varchar(120) null,
  `ccoPhone` varchar(40) null,
  `ccoEmail` varchar(180) null,
  `ccoDecisionRole` varchar(80) null,
  `ccoIsPrimary` boolean not null default '0',
  `ccoStatus` varchar(16) not null default 'Active',
  `ccoCreatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `ccoUpdatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblCRMContacts` add unique `uq_cco_key`(`ccoKey`);
alter table `tblCRMContacts` add index `idx_cco_customer_status`(`ccoCustomer_crcID`, `ccoStatus`);
alter table `tblCRMContacts` add constraint `fk_cco_customer` foreign key (`ccoCustomer_crcID`) references `tblCRMCustomers` (`crcID`) on update CASCADE on delete CASCADE;
CREATE TABLE `tblCRMAssets` (
  `casID` bigint unsigned not null auto_increment primary key,
  `casKey` varchar(32) not null,
  `casCustomer_crcID` bigint unsigned not null,
  `casProduct_crpID` bigint unsigned null,
  `casName` varchar(180) null,
  `casQuantity` decimal(18, 2) not null default '1',
  `casStatus` varchar(40) null,
  `casContract` varchar(180) null,
  `casExpiresAt` timestamp null,
  `casMeta` json null,
  `casCreatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `casUpdatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblCRMAssets` add unique `uq_cas_key`(`casKey`);
alter table `tblCRMAssets` add index `idx_cas_customer`(`casCustomer_crcID`);
alter table `tblCRMAssets` add index `idx_cas_product`(`casProduct_crpID`);
alter table `tblCRMAssets` add constraint `fk_cas_customer` foreign key (`casCustomer_crcID`) references `tblCRMCustomers` (`crcID`) on update CASCADE on delete CASCADE;
alter table `tblCRMAssets` add constraint `fk_cas_product` foreign key (`casProduct_crpID`) references `tblCRMProducts` (`crpID`) on update CASCADE on delete SET NULL;
CREATE TABLE `tblCRMTickets` (
  `ctkID` bigint unsigned not null auto_increment primary key,
  `ctkKey` varchar(32) not null,
  `ctkCustomer_crcID` bigint unsigned not null,
  `ctkTitle` varchar(220) not null,
  `ctkStatus` varchar(40) not null default 'باز',
  `ctkPriority` varchar(24) not null default 'متوسط',
  `ctkExternalRef` varchar(100) null,
  `ctkDescription` text null,
  `ctkCreatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `ctkUpdatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblCRMTickets` add unique `uq_ctk_key`(`ctkKey`);
alter table `tblCRMTickets` add index `idx_ctk_customer_status`(`ctkCustomer_crcID`, `ctkStatus`);
alter table `tblCRMTickets` add constraint `fk_ctk_customer` foreign key (`ctkCustomer_crcID`) references `tblCRMCustomers` (`crcID`) on update CASCADE on delete CASCADE;

-- 17_create_crm_sales.cjs
CREATE TABLE `tblCRMOpportunities` (
  `copID` bigint unsigned not null auto_increment primary key,
  `copKey` varchar(32) not null,
  `copWorkspace_crwID` bigint unsigned not null,
  `copCustomer_crcID` bigint unsigned not null,
  `copProduct_crpID` bigint unsigned null,
  `copOwner_usrID` bigint unsigned null,
  `copTitle` varchar(220) not null,
  `copQuantity` decimal(18, 2) not null default '1',
  `copValue` decimal(20, 0) not null default '0',
  `copStage` varchar(24) not null default 'lead',
  `copProbability` int unsigned not null default '25',
  `copExpectedClose` timestamp null,
  `copLastActivity` timestamp null,
  `copSource` varchar(100) null,
  `copRisk` text null,
  `copNextAction` text null,
  `copStatus` varchar(16) not null default 'Active',
  `copCreatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `copUpdatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblCRMOpportunities` add unique `uq_cop_key`(`copKey`);
alter table `tblCRMOpportunities` add index `idx_cop_workspace_stage`(`copWorkspace_crwID`, `copStage`, `copStatus`);
alter table `tblCRMOpportunities` add index `idx_cop_customer_status`(`copCustomer_crcID`, `copStatus`);
alter table `tblCRMOpportunities` add constraint `fk_cop_workspace` foreign key (`copWorkspace_crwID`) references `tblCRMWorkspaces` (`crwID`) on update CASCADE on delete CASCADE;
alter table `tblCRMOpportunities` add constraint `fk_cop_customer` foreign key (`copCustomer_crcID`) references `tblCRMCustomers` (`crcID`) on update CASCADE on delete CASCADE;
alter table `tblCRMOpportunities` add constraint `fk_cop_product` foreign key (`copProduct_crpID`) references `tblCRMProducts` (`crpID`) on update CASCADE on delete SET NULL;
alter table `tblCRMOpportunities` add constraint `fk_cop_owner` foreign key (`copOwner_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete SET NULL;
CREATE TABLE `tblCRMTasks` (
  `ctaID` bigint unsigned not null auto_increment primary key,
  `ctaKey` varchar(32) not null,
  `ctaWorkspace_crwID` bigint unsigned not null,
  `ctaCustomer_crcID` bigint unsigned null,
  `ctaOpportunity_copID` bigint unsigned null,
  `ctaAssigned_usrID` bigint unsigned null,
  `ctaCreatedBy_usrID` bigint unsigned not null,
  `ctaTitle` varchar(220) not null,
  `ctaDueAt` timestamp null,
  `ctaPriority` varchar(20) not null default 'medium',
  `ctaDoneAt` timestamp null,
  `ctaStatus` varchar(16) not null default 'Active',
  `ctaCreatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `ctaUpdatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblCRMTasks` add unique `uq_cta_key`(`ctaKey`);
alter table `tblCRMTasks` add index `idx_cta_workspace_due`(`ctaWorkspace_crwID`, `ctaStatus`, `ctaDueAt`);
alter table `tblCRMTasks` add index `idx_cta_assigned_done`(`ctaAssigned_usrID`, `ctaDoneAt`);
alter table `tblCRMTasks` add constraint `fk_cta_workspace` foreign key (`ctaWorkspace_crwID`) references `tblCRMWorkspaces` (`crwID`) on update CASCADE on delete CASCADE;
alter table `tblCRMTasks` add constraint `fk_cta_customer` foreign key (`ctaCustomer_crcID`) references `tblCRMCustomers` (`crcID`) on update CASCADE on delete SET NULL;
alter table `tblCRMTasks` add constraint `fk_cta_opportunity` foreign key (`ctaOpportunity_copID`) references `tblCRMOpportunities` (`copID`) on update CASCADE on delete SET NULL;
alter table `tblCRMTasks` add constraint `fk_cta_assigned` foreign key (`ctaAssigned_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete SET NULL;
alter table `tblCRMTasks` add constraint `fk_cta_creator` foreign key (`ctaCreatedBy_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete NO ACTION;
CREATE TABLE `tblCRMConversations` (
  `ccvID` bigint unsigned not null auto_increment primary key,
  `ccvKey` varchar(32) not null,
  `ccvWorkspace_crwID` bigint unsigned not null,
  `ccvCustomer_crcID` bigint unsigned not null,
  `ccvContact_ccoID` bigint unsigned null,
  `ccvAssigned_usrID` bigint unsigned null,
  `ccvChannel` varchar(24) not null default 'email',
  `ccvSubject` varchar(240) not null,
  `ccvBody` text not null,
  `ccvPreview` varchar(500) null,
  `ccvAI` json null,
  `ccvStatus` varchar(20) not null default 'Open',
  `ccvCreatedAt` timestamp not null default CURRENT_TIMESTAMP,
  `ccvUpdatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblCRMConversations` add unique `uq_ccv_key`(`ccvKey`);
alter table `tblCRMConversations` add index `idx_ccv_workspace_status`(`ccvWorkspace_crwID`, `ccvStatus`, `ccvUpdatedAt`);
alter table `tblCRMConversations` add index `idx_ccv_customer_updated`(`ccvCustomer_crcID`, `ccvUpdatedAt`);
alter table `tblCRMConversations` add constraint `fk_ccv_workspace` foreign key (`ccvWorkspace_crwID`) references `tblCRMWorkspaces` (`crwID`) on update CASCADE on delete CASCADE;
alter table `tblCRMConversations` add constraint `fk_ccv_customer` foreign key (`ccvCustomer_crcID`) references `tblCRMCustomers` (`crcID`) on update CASCADE on delete CASCADE;
alter table `tblCRMConversations` add constraint `fk_ccv_contact` foreign key (`ccvContact_ccoID`) references `tblCRMContacts` (`ccoID`) on update CASCADE on delete SET NULL;
alter table `tblCRMConversations` add constraint `fk_ccv_assigned` foreign key (`ccvAssigned_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete SET NULL;
CREATE TABLE `tblCRMConversationMessages` (
  `ccmID` bigint unsigned not null auto_increment primary key,
  `ccmKey` varchar(32) not null,
  `ccmConversation_ccvID` bigint unsigned not null,
  `ccmSender_usrID` bigint unsigned null,
  `ccmDirection` varchar(20) not null default 'Incoming',
  `ccmBody` text not null,
  `ccmCreatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblCRMConversationMessages` add unique `uq_ccm_key`(`ccmKey`);
alter table `tblCRMConversationMessages` add index `idx_ccm_conversation_time`(`ccmConversation_ccvID`, `ccmCreatedAt`);
alter table `tblCRMConversationMessages` add constraint `fk_ccm_conversation` foreign key (`ccmConversation_ccvID`) references `tblCRMConversations` (`ccvID`) on update CASCADE on delete CASCADE;
alter table `tblCRMConversationMessages` add constraint `fk_ccm_sender` foreign key (`ccmSender_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete SET NULL;
CREATE TABLE `tblCRMConversationReads` (
  `ccrID` bigint unsigned not null auto_increment primary key,
  `ccrConversation_ccvID` bigint unsigned not null,
  `ccrUser_usrID` bigint unsigned not null,
  `ccrReadAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblCRMConversationReads` add unique `uq_ccr_conversation_user`(`ccrConversation_ccvID`, `ccrUser_usrID`);
alter table `tblCRMConversationReads` add index `idx_ccr_user_read`(`ccrUser_usrID`, `ccrReadAt`);
alter table `tblCRMConversationReads` add constraint `fk_ccr_conversation` foreign key (`ccrConversation_ccvID`) references `tblCRMConversations` (`ccvID`) on update CASCADE on delete CASCADE;
alter table `tblCRMConversationReads` add constraint `fk_ccr_user` foreign key (`ccrUser_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete CASCADE;
CREATE TABLE `tblCRMActivities` (
  `cacID` bigint unsigned not null auto_increment primary key,
  `cacKey` varchar(32) not null,
  `cacWorkspace_crwID` bigint unsigned not null,
  `cacCustomer_crcID` bigint unsigned not null,
  `cacCreatedBy_usrID` bigint unsigned null,
  `cacType` varchar(32) not null default 'note',
  `cacTitle` varchar(220) not null,
  `cacDetail` text null,
  `cacRelatedType` varchar(32) null,
  `cacRelatedKey` varchar(32) null,
  `cacCreatedAt` timestamp not null default CURRENT_TIMESTAMP
);
alter table `tblCRMActivities` add unique `uq_cac_key`(`cacKey`);
alter table `tblCRMActivities` add index `idx_cac_customer_time`(`cacCustomer_crcID`, `cacCreatedAt`);
alter table `tblCRMActivities` add index `idx_cac_workspace_time`(`cacWorkspace_crwID`, `cacCreatedAt`);
alter table `tblCRMActivities` add constraint `fk_cac_workspace` foreign key (`cacWorkspace_crwID`) references `tblCRMWorkspaces` (`crwID`) on update CASCADE on delete CASCADE;
alter table `tblCRMActivities` add constraint `fk_cac_customer` foreign key (`cacCustomer_crcID`) references `tblCRMCustomers` (`crcID`) on update CASCADE on delete CASCADE;
alter table `tblCRMActivities` add constraint `fk_cac_creator` foreign key (`cacCreatedBy_usrID`) references `tblUser` (`usrID`) on update CASCADE on delete SET NULL;

-- 18_harden_tblUser_identity_lengths.cjs
alter table `tblUser` modify `usrEmail` varchar(254) null, modify `usrMobile` varchar(16) null;

-- 19_expand_tblLogs_action.cjs
alter table `tblLogs` modify `logAction` varchar(64) not null;

-- Dumping structure for procedure TargomanLLM.spGenAPIUser
DELIMITER //
CREATE PROCEDURE `spGenAPIUser`(
	IN `iPhone` VARCHAR(50)
)
BEGIN
	SELECT JSON_OBJECT('client_id', SUBSTR(MD5(tblUser.usrID),1,6), 'secret', tblUser.usrKey)
     FROM tblUser
	 WHERE tblUser.usrMobile = iPhone;
	
END//
DELIMITER ;

-- Dumping structure for trigger TargomanLLM.trg
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `trg` AFTER INSERT ON `tblMessages` FOR EACH ROW BEGIN
   IF NEW.msgStatus = 'Finished' THEN
		UPDATE tblChats
		   SET tblChats.chtLast_msgID = NEW.msgID
		 WHERE tblChats.chtID = NEW.msgRelated_chtID;
	END IF;
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;


-- Stable IDs required by tblGroup.ts and authService.ts.
-- Verified users inherit the public quotas; no administrative privileges are granted.
INSERT INTO tblGroup (grpID, grpName, grpPrivs, grpStatus) VALUES
 (1, 'anonymous', '{}', 'Active'),
 (2, 'public', '{"services":{"rag":{"files":{"maxSize":10,"maxCount":10,"maxTotalSize":200},"messages":{"maxChars":2000}},"think":{"forbidden":true}}}', 'Active'),
 (3, 'verified', '{"services":{"rag":{"files":{"maxSize":10,"maxCount":10,"maxTotalSize":200},"messages":{"maxChars":2000}},"think":{"forbidden":true}},"isVerified":true}', 'Active'),
 (4, 'widget', '{"services":{"rag":{"files":{"maxSize":10,"maxCount":10,"maxTotalSize":200},"messages":{"maxChars":2000}}}}', 'Active');
INSERT INTO tblUser (usrID, usrName, usrAssigned_grpID)
 VALUES (1, 'unknown', 1),
 VALUES (3, 'global',  1);

INSERT INTO tblPerUserStats (pusAssigned_usrID, pusService) VALUES (1, 'rag');

-- Record the schema baseline so Knex does not recreate these tables later.
CREATE TABLE knex_migrations (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(255), batch INT, migration_time TIMESTAMP NULL
) ENGINE=InnoDB;
CREATE TABLE knex_migrations_lock (
 `index` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 is_locked INT NOT NULL
) ENGINE=InnoDB;
INSERT INTO knex_migrations_lock (is_locked) VALUES (0);
INSERT INTO knex_migrations (name,batch,migration_time) VALUES
 ('1_tblLogs.cjs', 1, CURRENT_TIMESTAMP),
 ('2_tblGroup.cjs', 1, CURRENT_TIMESTAMP),
 ('3_tblUser.cjs', 1, CURRENT_TIMESTAMP),
 ('4_tblFiles.cjs', 1, CURRENT_TIMESTAMP),
 ('5_tblChats.cjs', 1, CURRENT_TIMESTAMP),
 ('6_tblMessage.cjs', 1, CURRENT_TIMESTAMP),
 ('7_tblPerUserStats.cjs', 1, CURRENT_TIMESTAMP),
 ('8_tblSampleQuestions.cjs', 1, CURRENT_TIMESTAMP),
 ('9_tblMultiDic.cjs', 1, CURRENT_TIMESTAMP),
 ('10_alter_tblUser_profile.cjs', 1, CURRENT_TIMESTAMP),
 ('11_tblWidgets.cjs', 1, CURRENT_TIMESTAMP),
 ('12_tblWidgetOperators.cjs', 1, CURRENT_TIMESTAMP),
 ('13_tblWidgetSessions.cjs', 1, CURRENT_TIMESTAMP),
 ('14_tblWidgetHumanReplies.cjs', 1, CURRENT_TIMESTAMP),
 ('15_create_crm_workspace.cjs', 1, CURRENT_TIMESTAMP),
 ('16_create_crm_customers.cjs', 1, CURRENT_TIMESTAMP),
 ('17_create_crm_sales.cjs', 1, CURRENT_TIMESTAMP),
 ('18_harden_tblUser_identity_lengths.cjs', 1, CURRENT_TIMESTAMP),
 ('19_expand_tblLogs_action.cjs', 1, CURRENT_TIMESTAMP);
-- Migration 9's table is included; the dictionary corpus is intentionally not seeded.


SET FOREIGN_KEY_CHECKS = @bootstrap_old_fk;
SET SQL_MODE = @bootstrap_old_mode;
SET TIME_ZONE = @bootstrap_old_tz;

-- Remote MySQL administrator. Does not change root@localhost.
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'CHANGE_ME_ROOT_PASSWORD';
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'CHANGE_ME_ROOT_PASSWORD';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;

SELECT 'TargomanLLM bootstrap complete' AS result;
