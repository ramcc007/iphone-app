#!/usr/bin/env python3
"""NumFall 1.1 App Store listing: English (U.S.) and English (U.K.) for now (owner's decision, 24 October 2026).
The 11 other translations are kept in LATER, ready for when the owner wants more languages.

Run from the repo root: python3 tools/appstore/listing_1_1.py
It checks Apple's character limits and the banned-name list, then writes docs/APP_STORE_LISTING_1.1.md.
Keywords: comma-separated, no spaces after commas, and no word already used in that locale's name or subtitle
(Apple already indexes those). Apple combines words only within one localization.
"""
import re
import sys

LIMITS = {"name": 30, "subtitle": 30, "keywords": 100, "promo": 170, "whatsnew": 4000, "description": 4000}

# Names of other games and brands must never appear (CLAUDE.md, Guidelines 2.3.7 and 5.2).
BANNED = ["sudoku", "kakuro", "nonogram", "picross", "2048", "tetris", "wordle", "kenken", "killer",
          "ナンプレ", "数独", "스도쿠", "судоку", "nikoli"]

EN_DESCRIPTION = open("docs/APP_STORE_LISTING.md", encoding="utf-8").read().split("## Description (4000 max)\n", 1)[1].split("\n## ", 1)[0].strip()

L = [
    # ---- English (U.S.): primary. Indexed in the US and many other storefronts.
    dict(code="en-US", label="English (U.S.)",
         name="NumFall: Number Puzzle Game",
         subtitle="Brain Games & Logic Puzzles",
         keywords="math,numbers,grid,gravity,drop,daily,challenge,timer,mind,iq,train,offline,teaser,smart,family",
         promo="A fresh Daily Drop every day. Keep your streak alive and race the clock through 230 levels on three boards, from a quick 4×4 to a big 9×9.",
         whatsnew="Small improvements and polish. Thank you for playing NumFall! If you enjoy it, a rating on the App Store helps a lot.",
         description=EN_DESCRIPTION),
    # ---- English (U.K.): reported to be indexed in the UK, India, Australia and other English storefronts. Different words from en-US.
    dict(code="en-GB", label="English (U.K.)",
         name="NumFall: Number Puzzle Game",
         subtitle="Maths & Logic Brain Teaser",
         keywords="brainteaser,logical,numeric,sum,column,row,fill,speed,clever,think,solve,square,riddle,focus",
         promo="A fresh Daily Drop every day. Keep your streak alive and race the clock through 230 levels on three boards, from a quick 4×4 to a big 9×9.",
         whatsnew="Small improvements and polish. Thank you for playing NumFall! If you enjoy it, a rating on the App Store helps a lot.",
         description=EN_DESCRIPTION),
]

# Not used yet (owner's decision, 24 October 2026: English only for now). Move entries into L to publish them.
LATER = [
    # ---- Spanish (Mexico): reported to be indexed in the US storefront too, so it also reaches Spanish speakers in the US.
    dict(code="es-MX", label="Spanish (Mexico)",
         name="NumFall: Puzzle de Números",
         subtitle="Juego de lógica para adultos",
         keywords="rompecabezas,numeros,matematicas,mente,cerebro,acertijo,reto,diario,cuadricula,mental,gravedad",
         promo="Un nuevo Daily Drop cada día. Mantén tu racha y gánale al reloj en 230 niveles y tres tableros, desde un rápido 4×4 hasta un gran 9×9.",
         whatsnew="Pequeñas mejoras. ¡Gracias por jugar NumFall! Si te gusta, una calificación en el App Store nos ayuda mucho.",
         description="""Elige un número. Suéltalo. Míralo caer en su lugar.

NumFall es un puzzle de números rápido y colorido con un giro: la gravedad. Toca un número, toca una columna y el número cae a la casilla vacía más baja. Llena la cuadrícula para que cada fila, cada columna y cada caja tenga cada número una sola vez, antes de que se acabe el tiempo.

Como los números caen, el orden en que los sueltas es el verdadero reto. Piensa una jugada adelante y gánale al reloj.

TRES TABLEROS, TODOS ABIERTOS DESDE EL PRIMER DÍA
• Rápido 4×4: 30 niveles cortos
• Clásico 6×6: 100 niveles que suben de dificultad paso a paso
• Maestro 9×9: 100 tableros grandes para expertos

UN PUZZLE NUEVO CADA DÍA
El Daily Drop es el mismo puzzle para todos. Resuélvelo, suma tu racha y compite en Game Center.

• Cada nivel se resuelve con lógica, sin adivinar
• Logros y tablas de clasificación con Game Center
• Tu progreso se sincroniza con iCloud en iPhone y iPad
• Un tutorial de un minuto te enseña todo

El juego está en inglés, pero solo necesitas números para jugar.

¿Preguntas o ideas? Escríbenos a support@numfall.store."""),
    # ---- Spanish (Spain)
    dict(code="es-ES", label="Spanish (Spain)",
         name="NumFall: Puzle de Números",
         subtitle="Juego de lógica y cálculo",
         keywords="rompecabezas,numeros,matematicas,mente,cerebro,acertijo,reto,diario,cuadricula,adultos,mental",
         promo="Un nuevo Daily Drop cada día. Mantén tu racha y gana al reloj en 230 niveles y tres tableros, desde un rápido 4×4 hasta un gran 9×9.",
         whatsnew="Pequeñas mejoras. ¡Gracias por jugar a NumFall! Si te gusta, una valoración en el App Store nos ayuda mucho.",
         description="""Elige un número. Suéltalo. Míralo caer en su sitio.

NumFall es un puzle de números rápido y colorido con un giro: la gravedad. Toca un número, toca una columna y el número cae a la casilla vacía más baja. Rellena la cuadrícula para que cada fila, cada columna y cada caja tenga cada número una sola vez, antes de que se acabe el tiempo.

Como los números caen, el orden en que los sueltas es el verdadero reto. Piensa una jugada por delante y gana al reloj.

TRES TABLEROS, TODOS ABIERTOS DESDE EL PRIMER DÍA
• Rápido 4×4: 30 niveles cortos
• Clásico 6×6: 100 niveles que suben de dificultad paso a paso
• Maestro 9×9: 100 tableros grandes para expertos

UN PUZLE NUEVO CADA DÍA
El Daily Drop es el mismo puzle para todos. Resuélvelo, suma tu racha y compite en Game Center.

• Cada nivel se resuelve con lógica, sin adivinar
• Logros y clasificaciones con Game Center
• Tu progreso se sincroniza con iCloud en iPhone y iPad
• Un tutorial de un minuto te lo enseña todo

El juego está en inglés, pero solo necesitas números para jugar.

¿Preguntas o ideas? Escríbenos a support@numfall.store."""),
    # ---- Portuguese (Brazil)
    dict(code="pt-BR", label="Portuguese (Brazil)",
         name="NumFall: Jogo de Números",
         subtitle="Quebra-cabeça de lógica",
         keywords="raciocinio,cerebro,mente,desafio,diario,matematica,enigma,treino,offline,puzzle,adultos,calculo",
         promo="Um novo Daily Drop todo dia. Mantenha sua sequência e vença o relógio em 230 fases e três tabuleiros, de um rápido 4×4 a um grande 9×9.",
         whatsnew="Pequenas melhorias. Obrigado por jogar NumFall! Se você gosta, uma avaliação na App Store ajuda muito.",
         description="""Escolha um número. Solte. Veja ele cair no lugar.

NumFall é um quebra-cabeça de números rápido e colorido com uma novidade: a gravidade. Toque em um número, toque em uma coluna e o número cai até a casa vazia mais baixa. Preencha a grade para que cada linha, cada coluna e cada caixa tenha cada número uma única vez, antes que o tempo acabe.

Como os números caem, a ordem em que você solta é o verdadeiro desafio. Pense uma jogada à frente e vença o relógio.

TRÊS TABULEIROS, TODOS ABERTOS DESDE O INÍCIO
• Rápido 4×4: 30 fases curtas
• Clássico 6×6: 100 fases que ficam mais difíceis aos poucos
• Mestre 9×9: 100 tabuleiros grandes para especialistas

UM DESAFIO NOVO TODO DIA
O Daily Drop é o mesmo quebra-cabeça para todos. Resolva, aumente sua sequência e dispute no Game Center.

• Toda fase se resolve com lógica, sem chutar
• Conquistas e rankings com Game Center
• Seu progresso sincroniza pelo iCloud no iPhone e iPad
• Um tutorial de um minuto ensina tudo

O jogo está em inglês, mas você só precisa de números para jogar.

Dúvidas ou ideias? Escreva para support@numfall.store."""),
    # ---- French
    dict(code="fr-FR", label="French",
         name="NumFall : Puzzle de Chiffres",
         subtitle="Jeu de logique et réflexion",
         keywords="casse-tete,cerveau,nombres,calcul,mental,defi,quotidien,grille,enigme,esprit,adulte,maths",
         promo="Un nouveau Daily Drop chaque jour. Gardez votre série et battez le chrono sur 230 niveaux et trois grilles, du rapide 4×4 au grand 9×9.",
         whatsnew="Petites améliorations. Merci de jouer à NumFall ! Si vous aimez le jeu, une note sur l'App Store nous aide beaucoup.",
         description="""Choisissez un chiffre. Lâchez-le. Regardez-le tomber à sa place.

NumFall est un puzzle de chiffres rapide et coloré, avec une particularité : la gravité. Touchez un chiffre, touchez une colonne, et il tombe dans la case vide la plus basse. Remplissez la grille pour que chaque ligne, chaque colonne et chaque bloc contienne chaque chiffre une seule fois, avant la fin du chrono.

Comme les chiffres tombent, l'ordre dans lequel vous les lâchez est le vrai défi. Pensez un coup à l'avance et battez le chrono.

TROIS GRILLES, TOUTES OUVERTES DÈS LE DÉPART
• Rapide 4×4 : 30 niveaux express
• Classique 6×6 : 100 niveaux de plus en plus durs
• Maître 9×9 : 100 grandes grilles pour les experts

UN NOUVEAU DÉFI CHAQUE JOUR
Le Daily Drop est le même puzzle pour tout le monde. Résolvez-le, prolongez votre série et grimpez dans Game Center.

• Chaque niveau se résout par la logique, sans deviner
• Succès et classements avec Game Center
• Votre progression se synchronise via iCloud sur iPhone et iPad
• Un tutoriel d'une minute explique tout

Le jeu est en anglais, mais il suffit de connaître les chiffres pour jouer.

Une question ou une idée ? Écrivez à support@numfall.store."""),
    # ---- German
    dict(code="de-DE", label="German",
         name="NumFall: Zahlenrätsel",
         subtitle="Logik-Puzzle & Gehirnjogging",
         keywords="zahlen,denkspiel,knobeln,mathe,raetsel,logikspiel,taeglich,kopf,training,denken,rechnen,offline",
         promo="Jeden Tag ein neuer Daily Drop. Halte deine Serie und schlage die Uhr in 230 Levels auf drei Brettern, vom schnellen 4×4 bis zum großen 9×9.",
         whatsnew="Kleine Verbesserungen. Danke, dass du NumFall spielst! Wenn es dir gefällt, hilft uns eine Bewertung im App Store sehr.",
         description="""Wähle eine Zahl. Lass sie fallen. Sieh zu, wie sie ihren Platz findet.

NumFall ist ein schnelles, buntes Zahlenrätsel mit einem Dreh: Schwerkraft. Tippe auf eine Zahl, tippe auf eine Spalte, und sie fällt in das unterste freie Feld. Fülle das Gitter so, dass jede Zeile, jede Spalte und jeder Block jede Zahl genau einmal enthält, bevor die Zeit abläuft.

Weil die Zahlen fallen, ist die Reihenfolge das eigentliche Rätsel. Denk einen Zug voraus und schlag die Uhr.

DREI BRETTER, ALLE VON ANFANG AN OFFEN
• Schnell 4×4: 30 kurze Levels
• Klassisch 6×6: 100 Levels, die Schritt für Schritt schwerer werden
• Meister 9×9: 100 große Bretter für echte Rätselfans

JEDEN TAG EIN NEUES RÄTSEL
Der Daily Drop ist für alle dasselbe Rätsel. Löse ihn, baue deine Serie aus und miss dich im Game Center.

• Jedes Level ist mit Logik lösbar, ohne Raten
• Erfolge und Bestenlisten mit Game Center
• Dein Fortschritt wird per iCloud auf iPhone und iPad synchronisiert
• Ein einminütiges Tutorial erklärt alles

Das Spiel ist auf Englisch, aber zum Spielen brauchst du nur Zahlen.

Fragen oder Ideen? Schreib an support@numfall.store."""),
    # ---- Italian
    dict(code="it", label="Italian",
         name="NumFall: Puzzle di Numeri",
         subtitle="Giochi di logica per adulti",
         keywords="rompicapo,mente,cervello,matematica,enigmi,sfida,quotidiana,griglia,allenamento,calcolo,cifre",
         promo="Un nuovo Daily Drop ogni giorno. Tieni viva la serie e batti il tempo in 230 livelli su tre tabelloni, dal rapido 4×4 al grande 9×9.",
         whatsnew="Piccoli miglioramenti. Grazie per giocare a NumFall! Se ti piace, una valutazione su App Store ci aiuta molto.",
         description="""Scegli un numero. Lascialo cadere. Guardalo andare al suo posto.

NumFall è un puzzle di numeri veloce e colorato con una novità: la gravità. Tocca un numero, tocca una colonna e il numero cade nella casella vuota più in basso. Riempi la griglia in modo che ogni riga, ogni colonna e ogni riquadro contenga ogni numero una sola volta, prima che scada il tempo.

Visto che i numeri cadono, l'ordine in cui li lasci andare è la vera sfida. Pensa una mossa avanti e batti il tempo.

TRE TABELLONI, TUTTI APERTI DA SUBITO
• Rapido 4×4: 30 livelli brevi
• Classico 6×6: 100 livelli che diventano più difficili passo dopo passo
• Maestro 9×9: 100 grandi tabelloni per veri appassionati

UN PUZZLE NUOVO OGNI GIORNO
Il Daily Drop è lo stesso puzzle per tutti. Risolvilo, allunga la tua serie e sfida gli altri su Game Center.

• Ogni livello si risolve con la logica, senza tirare a indovinare
• Obiettivi e classifiche con Game Center
• I progressi si sincronizzano con iCloud su iPhone e iPad
• Un tutorial di un minuto spiega tutto

Il gioco è in inglese, ma per giocare bastano i numeri.

Domande o idee? Scrivi a support@numfall.store."""),
    # ---- Japanese
    dict(code="ja", label="Japanese",
         name="NumFall: 数字パズル",
         subtitle="頭脳ロジックパズル・脳トレゲーム",
         keywords="数字,計算,算数,暇つぶし,簡単,タイムアタック,デイリー,パズルゲーム,思考,大人,数学,頭,トレーニング,論理,ブロック,頭の体操,ロジックゲーム,数字ゲーム,推理,集中力",
         promo="毎日新しいDaily Dropに挑戦。連続記録をのばして、4×4から9×9まで3つのボード、230ステージで時間と勝負しよう。",
         whatsnew="細かな改善を行いました。NumFallを遊んでいただきありがとうございます！気に入っていただけたら、App Storeでの評価がとても励みになります。",
         description="""数字を選んで、落とすだけ。

NumFallは、重力がある新しい数字パズルです。数字をタップして列をタップすると、いちばん下の空いているマスまで落ちていきます。制限時間内に、すべての行・列・ブロックに同じ数字が1回ずつ入るようにグリッドを埋めましょう。

数字は下から積み上がるので、落とす順番こそがパズル。一手先を読んで、時間内にクリアしよう。

3つのボードすべてを最初から遊べます
• クイック 4×4:短い30ステージ
• クラシック 6×6:少しずつ難しくなる100ステージ
• マスター 9×9:上級者向けの大きな100ステージ

毎日の新しいパズル
Daily Dropは全員共通の今日のパズル。クリアして連続記録をのばし、Game Centerで競おう。

• すべてのステージは推理だけで解けます
• Game Centerの実績とランキング
• iCloudでiPhoneとiPadの進行状況を同期
• 1分でわかるチュートリアル

ゲーム内の表示は英語ですが、数字がわかれば遊べます。

ご質問やご意見は support@numfall.store まで。"""),
    # ---- Korean
    dict(code="ko", label="Korean",
         name="NumFall: 숫자 퍼즐",
         subtitle="두뇌 게임 & 논리 퍼즐",
         keywords="숫자게임,수학,계산,브레인,머리,데일리,타이머,오프라인,집중력,퍼즐게임,두뇌훈련,성인,추리,도전,로직,머리쓰는게임,시간제한,수학게임,계산게임",
         promo="매일 새로운 Daily Drop에 도전하세요. 연속 기록을 이어가며 4×4부터 9×9까지 3개 보드, 230개 레벨에서 시간과 싸우세요.",
         whatsnew="작은 개선 사항을 적용했습니다. NumFall을 즐겨 주셔서 감사합니다! 마음에 드셨다면 App Store 평가가 큰 힘이 됩니다.",
         description="""숫자를 고르고, 떨어뜨리세요.

NumFall은 중력이 더해진 색다른 숫자 퍼즐입니다. 숫자를 탭하고 열을 탭하면 가장 아래 빈칸까지 떨어집니다. 제한 시간 안에 모든 행, 열, 박스에 각 숫자가 한 번씩만 들어가도록 격자를 채우세요.

숫자가 아래부터 쌓이기 때문에 떨어뜨리는 순서가 진짜 퍼즐입니다. 한 수 앞을 내다보고 시간을 이기세요.

처음부터 열려 있는 3개의 보드
• 퀵 4×4: 짧은 30개 레벨
• 클래식 6×6: 점점 어려워지는 100개 레벨
• 마스터 9×9: 퍼즐 고수를 위한 100개의 큰 보드

매일 새로운 퍼즐
Daily Drop은 모두에게 똑같은 오늘의 퍼즐입니다. 풀고, 연속 기록을 쌓고, Game Center에서 겨뤄 보세요.

• 모든 레벨은 추측 없이 논리만으로 풀 수 있습니다
• Game Center 업적과 리더보드
• iCloud로 iPhone과 iPad 진행 상황 동기화
• 1분 튜토리얼로 바로 시작

게임 화면은 영어지만, 숫자만 알면 플레이할 수 있습니다.

문의나 의견은 support@numfall.store로 보내 주세요."""),
    # ---- Hindi: reported to be indexed in India. Keywords mix Hindi and romanised Hindi, which many players type.
    dict(code="hi", label="Hindi",
         name="NumFall: नंबर पज़ल गेम",
         subtitle="दिमागी खेल और लॉजिक पहेली",
         keywords="संख्या,गणित,बुद्धि,दिमाग,तर्क,रोज़,चुनौती,paheli,dimag,ganit,khel,number,puzzle,brain,game",
         promo="हर दिन एक नया Daily Drop. अपनी स्ट्रीक बनाए रखें और 4×4 से 9×9 तक तीन बोर्ड के 230 लेवल में घड़ी को हराएं.",
         whatsnew="छोटे सुधार. NumFall खेलने के लिए धन्यवाद! अगर आपको पसंद आए, तो App Store पर रेटिंग देना हमारी बहुत मदद करता है.",
         description="""एक नंबर चुनें. उसे गिराएं. उसे अपनी जगह पर गिरते देखें.

NumFall एक तेज़ और रंगीन नंबर पज़ल है, जिसमें एक नया मोड़ है: गुरुत्वाकर्षण. किसी नंबर पर टैप करें, फिर किसी कॉलम पर टैप करें, और नंबर सबसे नीचे के खाली खाने में गिर जाता है. समय खत्म होने से पहले ग्रिड को ऐसे भरें कि हर पंक्ति, हर कॉलम और हर बॉक्स में हर नंबर सिर्फ एक बार आए.

क्योंकि नंबर नीचे गिरते हैं, उन्हें गिराने का क्रम ही असली पहेली है. एक चाल आगे सोचें और घड़ी को हराएं.

तीन बोर्ड, सभी पहले दिन से खुले
• क्विक 4×4: 30 छोटे लेवल
• क्लासिक 6×6: 100 लेवल जो धीरे-धीरे कठिन होते हैं
• मास्टर 9×9: पज़ल के शौकीनों के लिए 100 बड़े बोर्ड

हर दिन नई पहेली
Daily Drop सभी के लिए एक ही पहेली है. इसे हल करें, अपनी स्ट्रीक बढ़ाएं और Game Center पर मुकाबला करें.

• हर लेवल सिर्फ तर्क से हल होता है, अंदाज़े की ज़रूरत नहीं
• Game Center पर उपलब्धियां और लीडरबोर्ड
• iCloud से iPhone और iPad पर प्रगति सिंक होती है
• एक मिनट का ट्यूटोरियल सब सिखा देता है

गेम अंग्रेज़ी में है, लेकिन खेलने के लिए बस नंबर आने चाहिए.

सवाल या सुझाव? support@numfall.store पर लिखें."""),
    # ---- Indonesian
    dict(code="id", label="Indonesian",
         name="NumFall: Puzzle Angka",
         subtitle="Game Asah Otak & Logika",
         keywords="teka-teki,matematika,berhitung,tantangan,harian,cepat,offline,santai,pikiran,dewasa,cerdas",
         promo="Daily Drop baru setiap hari. Jaga streak kamu dan kalahkan waktu di 230 level dan tiga papan, dari 4×4 yang cepat sampai 9×9 yang besar.",
         whatsnew="Perbaikan kecil. Terima kasih sudah bermain NumFall! Kalau kamu suka, rating di App Store sangat membantu kami.",
         description="""Pilih angka. Jatuhkan. Lihat angka itu jatuh ke tempatnya.

NumFall adalah puzzle angka yang cepat dan penuh warna dengan satu hal unik: gravitasi. Ketuk sebuah angka, ketuk sebuah kolom, dan angka itu jatuh ke kotak kosong paling bawah. Isi kisi agar setiap baris, setiap kolom, dan setiap blok berisi setiap angka tepat satu kali, sebelum waktu habis.

Karena angka-angka jatuh, urutan kamu menjatuhkannya adalah teka-teki yang sebenarnya. Pikirkan satu langkah ke depan dan kalahkan waktu.

TIGA PAPAN, SEMUA TERBUKA SEJAK AWAL
• Cepat 4×4: 30 level singkat
• Klasik 6×6: 100 level yang makin sulit sedikit demi sedikit
• Master 9×9: 100 papan besar untuk penggemar puzzle

PUZZLE BARU SETIAP HARI
Daily Drop adalah puzzle yang sama untuk semua orang. Selesaikan, tambah streak kamu, dan bersaing di Game Center.

• Setiap level bisa diselesaikan dengan logika, tanpa menebak
• Pencapaian dan papan peringkat di Game Center
• Progres tersinkron lewat iCloud di iPhone dan iPad
• Tutorial satu menit menjelaskan semuanya

Game ini berbahasa Inggris, tapi kamu hanya perlu angka untuk bermain.

Pertanyaan atau ide? Tulis ke support@numfall.store."""),
    # ---- Turkish
    dict(code="tr", label="Turkish",
         name="NumFall: Sayı Bulmacası",
         subtitle="Zeka ve Mantık Oyunu",
         keywords="sayilar,matematik,beyin,akil,zihin,gunluk,izgara,hizli,cevrimdisi,eglenceli,yetiskin,hesap,bulmaca",
         promo="Her gün yeni bir Daily Drop. Serini koru ve hızlı 4×4'ten büyük 9×9'a kadar üç tahtada, 230 seviyede zamana karşı yarış.",
         whatsnew="Küçük iyileştirmeler. NumFall oynadığın için teşekkürler! Beğendiysen App Store'da vereceğin puan bize çok yardımcı olur.",
         description="""Bir sayı seç. Bırak. Yerine düşmesini izle.

NumFall, yerçekimi olan hızlı ve renkli bir sayı bulmacasıdır. Bir sayıya dokun, bir sütuna dokun ve sayı en alttaki boş kareye düşsün. Süre bitmeden ızgarayı, her satırda, her sütunda ve her kutuda her sayı yalnızca bir kez olacak şekilde doldur.

Sayılar aşağı düştüğü için onları bırakma sıran asıl bulmacadır. Bir hamle ileriyi düşün ve zamanı yen.

ÜÇ TAHTA, HEPSİ İLK GÜNDEN AÇIK
• Hızlı 4×4: 30 kısa seviye
• Klasik 6×6: adım adım zorlaşan 100 seviye
• Usta 9×9: bulmaca tutkunları için 100 büyük tahta

HER GÜN YENİ BİR BULMACA
Daily Drop herkes için aynı bulmacadır. Çöz, serini büyüt ve Game Center'da yarış.

• Her seviye tahmin gerektirmeden mantıkla çözülür
• Game Center başarıları ve liderlik tabloları
• İlerlemen iCloud ile iPhone ve iPad arasında eşitlenir
• Bir dakikalık eğitim her şeyi öğretir

Oyun İngilizce, ama oynamak için sadece sayıları bilmen yeterli.

Soru veya fikir? support@numfall.store adresine yaz."""),
]


def words(text):
    return {w for w in re.split(r"[\s:&,·・\-]+", text.lower()) if w}


def check():
    problems = []
    for loc in L:
        fields = {"name": loc["name"], "subtitle": loc["subtitle"], "keywords": loc["keywords"],
                  "promo": loc["promo"], "whatsnew": loc["whatsnew"], "description": loc["description"]}
        for key, value in fields.items():
            if len(value) > LIMITS[key]:
                problems.append(f"{loc['code']} {key}: {len(value)} > {LIMITS[key]}")
            low = value.lower()
            for bad in BANNED:
                if bad in low:
                    problems.append(f"{loc['code']} {key}: contains banned name '{bad}'")
        kws = loc["keywords"].split(",")
        if any(k != k.strip() or not k for k in kws):
            problems.append(f"{loc['code']} keywords: empty entry or space around a comma")
        if len(set(kws)) != len(kws):
            problems.append(f"{loc['code']} keywords: duplicate entry")
        taken = words(loc["name"]) | words(loc["subtitle"])
        dup = [k for k in kws if k.lower() in taken]
        if dup:
            problems.append(f"{loc['code']} keywords repeat name/subtitle words: {dup}")
    return problems


def render():
    out = ["# NumFall 1.1: App Store listing (English U.S. and English U.K.)",
           "",
           "Generated by `tools/appstore/listing_1_1.py`, which checks Apple's character limits, repeated keywords and the banned-name list. "
           "Edit the script, not this file.",
           "",
           "In App Store Connect: open version 1.1, pick each language in the language menu at the top right (add the language first if it isn't there), then paste the fields.",
           "Screenshots: use the same English screenshots for every language (App Store Connect reuses the primary language's screenshots when a language has none).",
           ""]
    out.append("| Language | Name | Subtitle | Keywords used |")
    out.append("|---|---|---|---|")
    for loc in L:
        out.append(f"| {loc['label']} | {len(loc['name'])}/30 | {len(loc['subtitle'])}/30 | {len(loc['keywords'])}/100 |")
    for loc in L:
        out += ["", f"## {loc['label']} (`{loc['code']}`)", "",
                f"**Name** ({len(loc['name'])}/30)", "```", loc["name"], "```",
                f"**Subtitle** ({len(loc['subtitle'])}/30)", "```", loc["subtitle"], "```",
                f"**Keywords** ({len(loc['keywords'])}/100)", "```", loc["keywords"], "```",
                f"**Promotional text** ({len(loc['promo'])}/170)", "```", loc["promo"], "```",
                f"**What's New in 1.1** ({len(loc['whatsnew'])}/4000)", "```", loc["whatsnew"], "```",
                f"**Description** ({len(loc['description'])}/4000)", "```", loc["description"], "```"]
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    issues = check()
    if issues:
        print("\n".join(issues))
        sys.exit(1)
    open("docs/APP_STORE_LISTING_1.1.md", "w", encoding="utf-8").write(render())
    for loc in L:
        print(f"{loc['code']:6} name {len(loc['name']):2}/30  subtitle {len(loc['subtitle']):2}/30  keywords {len(loc['keywords']):3}/100  promo {len(loc['promo']):3}/170")
