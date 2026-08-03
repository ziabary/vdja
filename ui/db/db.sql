-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.4.5 - MySQL Community Server - GPL
-- Server OS:                    Linux
-- HeidiSQL Version:             12.7.0.6850
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for TargomanLLM
CREATE DATABASE IF NOT EXISTS `TargomanLLM` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `TargomanLLM`;

-- Dumping structure for table TargomanLLM.tblChats
CREATE TABLE IF NOT EXISTS `tblChats` (
  `chtID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `chtKey` char(32) COLLATE utf8mb3_unicode_520_ci NOT NULL DEFAULT '',
  `chtOwner_usrID` bigint unsigned NOT NULL,
  `chtService` varchar(10) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_520_ci NOT NULL DEFAULT '',
  `chtTitle` varchar(100) COLLATE utf8mb3_unicode_520_ci DEFAULT NULL,
  `chtLast_msgID` bigint unsigned DEFAULT NULL,
  `chtCreatedAt` timestamp NOT NULL DEFAULT (now()),
  `chtStatus` enum('Active','Removed') COLLATE utf8mb3_unicode_520_ci NOT NULL DEFAULT 'Active',
  PRIMARY KEY (`chtID`),
  UNIQUE KEY `chtHash` (`chtKey`,`chtOwner_usrID`,`chtService`) USING BTREE,
  KEY `chtCreatedAt` (`chtCreatedAt`),
  KEY `chtStatus` (`chtStatus`),
  KEY `FK_tblChats_tblMessages` (`chtLast_msgID`),
  KEY `FK_tblChats_tblUser` (`chtOwner_usrID`) USING BTREE,
  KEY `chtService` (`chtService`),
  CONSTRAINT `FK_tblChats_tblMessages` FOREIGN KEY (`chtLast_msgID`) REFERENCES `tblMessages` (`msgID`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `FK_tblChats_tblUser` FOREIGN KEY (`chtOwner_usrID`) REFERENCES `tblUser` (`usrID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22027 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_520_ci;

-- Data exporting was unselected.

-- Dumping structure for table TargomanLLM.tblFiles
CREATE TABLE IF NOT EXISTS `tblFiles` (
  `filID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `filOwner_usrID` bigint unsigned NOT NULL,
  `filKey` char(32) COLLATE utf8mb3_unicode_520_ci NOT NULL DEFAULT '' COMMENT 'UUID',
  `filService` varchar(10) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_520_ci NOT NULL DEFAULT '',
  `filName` varchar(100) COLLATE utf8mb3_unicode_520_ci NOT NULL,
  `filSize` bigint(20) unsigned zerofill NOT NULL,
  `filChunkCount` int unsigned NOT NULL,
  `filUploadedAt` timestamp NOT NULL DEFAULT (now()),
  `filStatus` enum('Active','Removed','Processing') COLLATE utf8mb3_unicode_520_ci NOT NULL DEFAULT 'Processing',
  PRIMARY KEY (`filID`),
  UNIQUE KEY `filOwner_usrID_filKey` (`filOwner_usrID`,`filKey`,`filService`) USING BTREE,
  KEY `filKey` (`filKey`),
  KEY `filUploadedAt` (`filUploadedAt`),
  KEY `filStatus` (`filStatus`),
  KEY `filService` (`filService`),
  CONSTRAINT `FK_tblFile_tblUser` FOREIGN KEY (`filOwner_usrID`) REFERENCES `tblUser` (`usrID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=126996 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_520_ci;

-- Data exporting was unselected.

-- Dumping structure for table TargomanLLM.tblGroup
CREATE TABLE IF NOT EXISTS `tblGroup` (
  `grpID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `grpName` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `grpPrivs` json DEFAULT NULL,
  `grpStatus` enum('Active','Removed','Banned') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Active',
  PRIMARY KEY (`grpID`),
  KEY `grpStatus` (`grpStatus`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table TargomanLLM.tblLogs
CREATE TABLE IF NOT EXISTS `tblLogs` (
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
) ENGINE=InnoDB AUTO_INCREMENT=539646 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table TargomanLLM.tblMessages
CREATE TABLE IF NOT EXISTS `tblMessages` (
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
) ENGINE=InnoDB AUTO_INCREMENT=107363 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table TargomanLLM.tblMultiDic
CREATE TABLE IF NOT EXISTS `tblMultiDic` (
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
) ENGINE=InnoDB AUTO_INCREMENT=18201848 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_cs_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table TargomanLLM.tblNews
CREATE TABLE IF NOT EXISTS `tblNews` (
  `newsVDBID` char(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `newsLink` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `newsCreatedAt` timestamp NOT NULL DEFAULT (now()),
  `newsStatus` enum('Active','Removed') NOT NULL DEFAULT 'Active',
  PRIMARY KEY (`newsVDBID`),
  KEY `newsCreatedAt` (`newsCreatedAt`),
  KEY `newsStatus` (`newsStatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table TargomanLLM.tblPerUserStats
CREATE TABLE IF NOT EXISTS `tblPerUserStats` (
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
) ENGINE=InnoDB AUTO_INCREMENT=9284 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table TargomanLLM.tblSampleQuestions
CREATE TABLE IF NOT EXISTS `tblSampleQuestions` (
  `smqID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `smqAssigned_filID` bigint unsigned NOT NULL,
  `smqQuestion` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`smqID`),
  KEY `FK_tblSampleQuestions_tblFiles` (`smqAssigned_filID`) USING BTREE,
  CONSTRAINT `FK_tblSampleQuestions_tblFiles` FOREIGN KEY (`smqAssigned_filID`) REFERENCES `tblFiles` (`filID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2000 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table TargomanLLM.tblSharedFileRequests
CREATE TABLE IF NOT EXISTS `tblSharedFileRequests` (
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
) ENGINE=InnoDB AUTO_INCREMENT=86 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table TargomanLLM.tblSharedFiles
CREATE TABLE IF NOT EXISTS `tblSharedFiles` (
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
) ENGINE=InnoDB AUTO_INCREMENT=434 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table TargomanLLM.tblSharedFilesDownloads
CREATE TABLE IF NOT EXISTS `tblSharedFilesDownloads` (
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
) ENGINE=InnoDB AUTO_INCREMENT=959 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table TargomanLLM.tblUser
CREATE TABLE IF NOT EXISTS `tblUser` (
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
) ENGINE=InnoDB AUTO_INCREMENT=7947 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

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

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
