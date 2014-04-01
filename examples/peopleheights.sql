-- phpMyAdmin SQL Dump
-- version 3.5.7
-- http://www.phpmyadmin.net
--
-- Servidor: localhost
-- Temps de generació: 31-03-2014 a les 19:14:01
-- Versió del servidor: 5.5.29-log
-- Versió de PHP: 5.4.10

SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

--
-- Base de dades: `peopleheights`
--

-- --------------------------------------------------------

--
-- Estructura de la taula `measures`
--

CREATE TABLE `measures` (
  `idmeasure` int(11) NOT NULL,
  `timestamp` datetime DEFAULT NULL,
  `idperson` int(11) DEFAULT NULL,
  `height` float DEFAULT NULL,
  `parameters` text,
  PRIMARY KEY (`idmeasure`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Bolcant dades de la taula `measures`
--

INSERT INTO `measures` (`idmeasure`, `timestamp`, `idperson`, `height`, `parameters`) VALUES
(1, '1973-04-03 16:38:52', 1, 0.5, NULL),
(2, '1974-04-03 18:35:00', 1, 0.8, NULL),
(3, '1975-04-03 12:08:00', 1, 1.1, NULL),
(4, '2014-04-03 12:56:00', 1, 1.8, NULL);

-- --------------------------------------------------------

--
-- Estructura de la taula `persons`
--

CREATE TABLE `persons` (
  `idperson` int(11) NOT NULL,
  `firstname` varchar(45) DEFAULT NULL,
  `lastname` varchar(45) DEFAULT NULL,
  `birthdate` date DEFAULT NULL,
  PRIMARY KEY (`idperson`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Bolcant dades de la taula `persons`
--

INSERT INTO `persons` (`idperson`, `firstname`, `lastname`, `birthdate`) VALUES
(1, 'Jordi', 'Baylina', '1973-04-03');

-- --------------------------------------------------------

--
-- Estructura de la taula `sequences`
--

CREATE TABLE `sequences` (
  `name` varchar(256) CHARACTER SET latin1 NOT NULL,
  `last` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Bolcant dades de la taula `sequences`
--

INSERT INTO `sequences` (`name`, `last`) VALUES
('idmeasure', 4),
('idperson', 1);