<?php
    header('Content-Type: application/json');

    ini_set('display_errors', 1);
    error_reporting(E_ALL);

    include_once("./config.php");
    include_once("./user_classes.php");
    include_once("./data_handler.php");

    $dh_read = new DataHandle($dbConfig, $s3Config);

    $maxKeys = 10;

    $offset = isset($_POST["offset"]) ? (int)$_POST["offset"] : 0;

    /* ---------- ROUTER ---------- */
    if (!isset($_POST["key"]) && !isset($_POST["profile_uuid"]) ) {
        echo json_encode([
            "success" => false,
            "error" => "Missing post key and profile_uuid"
        ]);
        exit;
    }

    echo $dh_read->loadProfileFavorites($_POST["profile_uuid"] ?? null, $maxKeys, $offset);
    exit;

?>