<?php
// Kontaktformular-Versand (benötigt einen Webhost mit PHP und aktiviertem mail()).
// Empfänger hier anpassen:
// TESTPHASE: nach dem Test zurück auf 'die.alltagsengel@web.de' stellen!
const EMPFAENGER = 'mittlerpatrick0@gmail.com';

header('X-Content-Type-Options: nosniff');

function antwort(bool $ok, string $text, int $status = 200): void {
    $ajax = isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false;
    http_response_code($status);
    if ($ajax) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => $ok, 'message' => $text]);
    } else {
        header('Content-Type: text/html; charset=utf-8');
        $t = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
        echo '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kontakt – Alltagsengel Münch</title><link rel="stylesheet" href="styles.css"></head><body><main class="legal"><div class="container"><h1>' . ($ok ? 'Vielen Dank!' : 'Fehler') . '</h1><p>' . $t . '</p><p><a href="index.html#kontakt">← Zurück zur Startseite</a></p></div></main></body></html>';
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    antwort(false, 'Ungültige Anfrage.', 405);
}

// Spam-Schutz: verstecktes Feld muss leer bleiben
if (!empty($_POST['website'] ?? '')) {
    antwort(true, 'Vielen Dank! Ihre Nachricht wurde gesendet.');
}

$clean = fn(string $v): string => trim(str_replace(["\r", "\n"], ' ', strip_tags($v)));
$name    = $clean($_POST['name'] ?? '');
$email   = $clean($_POST['email'] ?? '');
$telefon = $clean($_POST['telefon'] ?? '');
$text    = trim(strip_tags($_POST['nachricht'] ?? ''));
$datenschutz = !empty($_POST['datenschutz']);

if ($name === '' || $text === '') {
    antwort(false, 'Bitte füllen Sie Name und Nachricht aus.', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/@[^@]+\.[a-z]{2,}$/i', $email)) {
    antwort(false, 'Die E-Mail-Adresse ist nicht korrekt. Bitte prüfen Sie Ihre Eingabe (z. B. name@beispiel.de).', 422);
}
if (!$datenschutz) {
    antwort(false, 'Bitte bestätigen Sie die Datenschutzerklärung.', 422);
}
if (mb_strlen($name) > 120 || mb_strlen($text) > 5000 || mb_strlen($telefon) > 40) {
    antwort(false, 'Ihre Eingabe ist zu lang.', 422);
}

$host = preg_replace('/[^a-z0-9.-]/i', '', $_SERVER['SERVER_NAME'] ?? 'localhost');
$betreff = '=?UTF-8?B?' . base64_encode('Neue Nachricht über die Website Alltagsengel Münch') . '?=';
$inhalt = "Name: $name\nE-Mail: $email\nTelefon: " . ($telefon ?: '–') . "\n\nNachricht:\n$text\n";
$header = [
    'From: Website Alltagsengel Münch <no-reply@' . $host . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
];

if (mail(EMPFAENGER, $betreff, $inhalt, implode("\r\n", $header))) {
    antwort(true, 'Vielen Dank! Ihre Nachricht wurde gesendet.');
}
antwort(false, 'Das Senden hat leider nicht geklappt. Bitte rufen Sie uns an: 02684 – 9767397.', 500);
