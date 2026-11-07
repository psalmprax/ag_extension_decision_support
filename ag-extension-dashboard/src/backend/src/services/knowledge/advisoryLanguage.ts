interface AdvisoryMessages {
    treatment: string;
    noEvidence: string;
    invalidEvidence: string;
}

export const ADVISORY_LANGUAGES = [
    'en', 'sw', 'fr', 'pt', 'es', 'zu', 'it', 'de', 'nl', 'da', 'pl', 'hu',
    'tr', 'ar', 'zh', 'hi', 'ru', 'uk', 'ro', 'cs', 'sk', 'bg', 'el', 'ug',
] as const;

const english: AdvisoryMessages = {
    treatment: 'I cannot verify a treatment rate or safe interval without the current locally registered label and field context. Do not apply an unverified dose. Please share the country, crop and growth stage; for pesticides, the exact product and label, or for fertilizer/lime, soil-test results. A local extension officer can help confirm the appropriate treatment.',
    noEvidence: 'Evidence note: no eligible source was retrieved for this answer. This is general guidance, not a verified field diagnosis or locally authorized treatment.',
    invalidEvidence: 'Evidence note: unsupported source references were removed. Verify the remaining claims against the supplied sources.',
};

const translations: Record<string, AdvisoryMessages> = {
    en: english,
    sw: {
        treatment: 'Siwezi kuthibitisha kipimo au muda salama wa matibabu bila lebo ya sasa iliyoidhinishwa katika nchi yako na taarifa za shamba. Usitumie kipimo kisichothibitishwa. Tafadhali taja nchi, zao na hatua ya ukuaji; kwa dawa, toa jina na lebo ya bidhaa, na kwa mbolea au chokaa, matokeo ya kipimo cha udongo. Afisa ugani anaweza kusaidia kuthibitisha matibabu yanayofaa.',
        noEvidence: 'Ushahidi: hakuna chanzo kinachofaa kilichopatikana. Huu ni mwongozo wa jumla, si utambuzi uliothibitishwa wala matibabu yaliyoidhinishwa nchini.',
        invalidEvidence: 'Marejeo yasiyoungwa mkono yameondolewa. Thibitisha madai yaliyobaki kwa kutumia vyanzo vilivyotolewa.',
    },
    fr: {
        treatment: 'Je ne peux pas confirmer une dose ou un délai sûr sans l’étiquette actuellement autorisée dans votre pays et les conditions de la parcelle. N’appliquez pas de dose non vérifiée. Précisez le pays, la culture et son stade, le produit et son étiquette, ou l’analyse du sol pour les engrais et la chaux. Consultez un conseiller agricole local.',
        noEvidence: 'Aucune source pertinente n’a été retrouvée. Ces conseils généraux ne constituent ni un diagnostic confirmé ni un traitement autorisé localement.',
        invalidEvidence: 'Les références non étayées ont été retirées. Vérifiez les autres affirmations dans les sources fournies.',
    },
    es: {
        treatment: 'No puedo confirmar una dosis o un plazo seguro sin la etiqueta actualmente autorizada en su país y las condiciones de la parcela. No aplique una dosis no verificada. Indique el país, cultivo y etapa, el producto y su etiqueta, o el análisis del suelo para fertilizantes y cal. Consulte a un asesor agrícola local.',
        noEvidence: 'No se recuperó ninguna fuente pertinente. Es orientación general, no un diagnóstico confirmado ni un tratamiento autorizado localmente.',
        invalidEvidence: 'Se eliminaron las referencias sin respaldo. Verifique las demás afirmaciones con las fuentes proporcionadas.',
    },
    pt: {
        treatment: 'Não posso confirmar uma dose ou um intervalo seguro sem o rótulo atualmente autorizado no seu país e as condições do campo. Não aplique doses não verificadas. Informe o país, a cultura e o estágio, o produto e o rótulo, ou a análise do solo para fertilizantes e calcário. Consulte a assistência técnica agrícola local.',
        noEvidence: 'Nenhuma fonte pertinente foi recuperada. Esta orientação geral não é um diagnóstico confirmado nem um tratamento autorizado localmente.',
        invalidEvidence: 'As referências sem respaldo foram removidas. Confira as demais afirmações nas fontes fornecidas.',
    },
    de: {
        treatment: 'Ohne die aktuell in Ihrem Land zugelassene Produktkennzeichnung und die Feldbedingungen kann ich keine Dosierung oder sichere Wartezeit bestätigen. Wenden Sie keine ungeprüfte Menge an. Nennen Sie Land, Kultur und Wachstumsstadium, Produkt und Etikett oder die Bodenanalyse für Dünger und Kalk. Fragen Sie die örtliche landwirtschaftliche Beratung.',
        noEvidence: 'Es wurde keine geeignete Quelle gefunden. Dies sind allgemeine Hinweise, keine bestätigte Diagnose oder örtlich zugelassene Behandlung.',
        invalidEvidence: 'Unbelegte Quellenverweise wurden entfernt. Prüfen Sie die übrigen Aussagen anhand der bereitgestellten Quellen.',
    },
    hi: {
        treatment: 'आपके देश में वर्तमान में स्वीकृत उत्पाद लेबल और खेत की जानकारी के बिना मैं मात्रा या सुरक्षित अंतराल की पुष्टि नहीं कर सकता। अप्रमाणित मात्रा न डालें। देश, फसल और विकास अवस्था, उत्पाद और उसका लेबल बताएं; उर्वरक या चूने के लिए मिट्टी जांच के परिणाम दें। स्थानीय कृषि विस्तार अधिकारी से पुष्टि कराएं।',
        noEvidence: 'कोई उपयुक्त स्रोत नहीं मिला। यह सामान्य मार्गदर्शन है, प्रमाणित निदान या स्थानीय रूप से अधिकृत उपचार नहीं।',
        invalidEvidence: 'बिना समर्थन वाले स्रोत संदर्भ हटा दिए गए हैं। बाकी दावों की दिए गए स्रोतों से पुष्टि करें।',
    },
    zh: {
        treatment: '没有您所在国家现行批准的产品标签和田间信息，我无法确认用量或安全间隔。请勿使用未经核实的剂量。请提供国家、作物和生长阶段、产品名称及标签；施肥或施石灰还需土壤检测结果。请向当地农技人员核实。',
        noEvidence: '未检索到适用来源。这是一般性建议，不是已确认的诊断或当地批准的处理方案。',
        invalidEvidence: '已移除无依据的来源引用。请根据提供的来源核实其余说法。',
    },
    ar: {
        treatment: 'لا يمكنني تأكيد الجرعة أو الفترة الآمنة دون الملصق المعتمد حاليًا في بلدك ومعلومات الحقل. لا تستخدم جرعة غير مؤكدة. اذكر البلد والمحصول ومرحلة النمو واسم المنتج وملصقه، أو نتائج تحليل التربة للأسمدة والجير. استشر مرشدًا زراعيًا محليًا.',
        noEvidence: 'لم يُعثر على مصدر مناسب. هذه إرشادات عامة وليست تشخيصًا مؤكدًا أو معالجة معتمدة محليًا.',
        invalidEvidence: 'أُزيلت المراجع غير المدعومة. تحقق من بقية الادعاءات باستخدام المصادر المقدمة.',
    },
    ru: {
        treatment: 'Без действующей в вашей стране инструкции к препарату и данных об участке я не могу подтвердить дозу или безопасный интервал. Не применяйте непроверенную дозу. Укажите страну, культуру и стадию роста, препарат и инструкцию; для удобрений и извести — результаты анализа почвы. Обратитесь к местному агроконсультанту.',
        noEvidence: 'Подходящий источник не найден. Это общие рекомендации, а не подтверждённый диагноз или разрешённая в вашей стране обработка.',
        invalidEvidence: 'Неподтверждённые ссылки удалены. Проверьте остальные утверждения по предоставленным источникам.',
    },
    uk: {
        treatment: 'Без чинної у вашій країні інструкції до препарату та даних про поле я не можу підтвердити дозу або безпечний інтервал. Не застосовуйте неперевірену дозу. Вкажіть країну, культуру і стадію росту, препарат та інструкцію; для добрив і вапна — результати аналізу ґрунту. Зверніться до місцевого агроконсультанта.',
        noEvidence: 'Відповідного джерела не знайдено. Це загальні поради, а не підтверджений діагноз або дозволена місцева обробка.',
        invalidEvidence: 'Непідтверджені посилання вилучено. Перевірте решту тверджень за наданими джерелами.',
    },
    it: {
        treatment: 'Non posso confermare una dose o un intervallo sicuro senza l’etichetta attualmente autorizzata nel suo paese e le condizioni del campo. Non applicare dosi non verificate. Indicare paese, coltura e fase, prodotto ed etichetta, o analisi del suolo per fertilizzanti e calce. Consultare un tecnico agricolo locale.',
        noEvidence: 'Non è stata recuperata una fonte pertinente. Sono indicazioni generali, non una diagnosi confermata o un trattamento autorizzato localmente.',
        invalidEvidence: 'I riferimenti non supportati sono stati rimossi. Verificare le altre affermazioni nelle fonti fornite.',
    },
    nl: {
        treatment: 'Zonder het momenteel in uw land toegelaten etiket en de veldgegevens kan ik geen dosering of veilige wachttijd bevestigen. Gebruik geen ongecontroleerde dosis. Vermeld land, gewas en groeistadium, product en etiket, of de bodemanalyse voor meststoffen en kalk. Raadpleeg de plaatselijke landbouwadviseur.',
        noEvidence: 'Er is geen geschikte bron gevonden. Dit is algemene informatie, geen bevestigde diagnose of lokaal toegelaten behandeling.',
        invalidEvidence: 'Niet-onderbouwde bronverwijzingen zijn verwijderd. Controleer de overige beweringen aan de hand van de verstrekte bronnen.',
    },
    tr: {
        treatment: 'Ülkenizde halen onaylı ürün etiketi ve tarla bilgileri olmadan dozu veya güvenli bekleme süresini doğrulayamam. Doğrulanmamış doz uygulamayın. Ülke, ürün ve gelişme dönemi, ilaç ve etiketini; gübre veya kireç için toprak analizi sonuçlarını paylaşın. Yerel tarım danışmanına başvurun.',
        noEvidence: 'Uygun bir kaynak bulunamadı. Bunlar genel önerilerdir; doğrulanmış tanı veya yerel olarak izin verilen bir uygulama değildir.',
        invalidEvidence: 'Desteklenmeyen kaynak atıfları kaldırıldı. Diğer iddiaları sağlanan kaynaklardan doğrulayın.',
    },
    zu: {
        treatment: 'Angikwazi ukuqinisekisa umthamo noma isikhathi esiphephile ngaphandle kwelebula lomkhiqizo eligunyaziwe ezweni lakho nolwazi lwensimu. Ungasebenzisi umthamo ongakaqinisekiswa. Nikeza izwe, isitshalo nesigaba sokukhula, umkhiqizo nelebula; kumanyolo noma umcako, nikeza imiphumela yokuhlolwa komhlabathi. Xhumana nomeluleki wezolimo wendawo.',
        noEvidence: 'Awutholakalanga umthombo ofanele. Lesi isiqondiso esivamile, hhayi ukuxilongwa okuqinisekisiwe noma ukwelashwa okugunyazwe endaweni.',
        invalidEvidence: 'Izinkomba zemithombo ezingasekelwe zisusiwe. Qinisekisa ezinye izimangalo ngemithombo enikeziwe.',
    },
    da: {
        treatment: 'Jeg kan ikke bekræfte en dosis eller sikker ventetid uden den aktuelt godkendte etiket i dit land og oplysninger om marken. Brug ikke en ubekræftet dosis. Oplys land, afgrøde og vækststadium, produkt og etiket eller jordanalysen for gødning og kalk. Kontakt en lokal landbrugsrådgiver.',
        noEvidence: 'Ingen egnet kilde blev fundet. Dette er generelle råd, ikke en bekræftet diagnose eller lokalt godkendt behandling.',
        invalidEvidence: 'Udokumenterede kildehenvisninger er fjernet. Kontrollér de øvrige påstande i de angivne kilder.',
    },
    pl: {
        treatment: 'Bez aktualnej etykiety zatwierdzonej w Twoim kraju i informacji o polu nie mogę potwierdzić dawki ani bezpiecznego okresu oczekiwania. Nie stosuj niezweryfikowanej dawki. Podaj kraj, uprawę i fazę wzrostu, produkt i etykietę lub analizę gleby dla nawozów i wapna. Skonsultuj się z lokalnym doradcą rolniczym.',
        noEvidence: 'Nie znaleziono odpowiedniego źródła. To ogólne wskazówki, nie potwierdzona diagnoza ani lokalnie zatwierdzony zabieg.',
        invalidEvidence: 'Usunięto niepotwierdzone odwołania. Sprawdź pozostałe twierdzenia w podanych źródłach.',
    },
    hu: {
        treatment: 'Az országában jelenleg engedélyezett termékcímke és a terület adatai nélkül nem tudom igazolni az adagot vagy a biztonságos várakozási időt. Ne alkalmazzon ellenőrizetlen adagot. Adja meg az országot, növényt és fejlődési szakaszt, a terméket és címkéjét, illetve műtrágyához vagy mészhez a talajvizsgálat eredményét. Kérjen helyi agrárszaktanácsot.',
        noEvidence: 'Nem találtunk megfelelő forrást. Ez általános tájékoztatás, nem igazolt diagnózis vagy helyileg engedélyezett kezelés.',
        invalidEvidence: 'Az alá nem támasztott hivatkozásokat eltávolítottuk. Ellenőrizze a többi állítást a megadott forrásokban.',
    },
    ro: {
        treatment: 'Nu pot confirma o doză sau un interval sigur fără eticheta autorizată în prezent în țara dumneavoastră și datele terenului. Nu aplicați o doză neverificată. Precizați țara, cultura și stadiul, produsul și eticheta sau analiza solului pentru îngrășăminte și amendamente calcaroase. Consultați un consilier agricol local.',
        noEvidence: 'Nu a fost găsită o sursă potrivită. Acestea sunt indicații generale, nu un diagnostic confirmat sau un tratament autorizat local.',
        invalidEvidence: 'Referințele neconfirmate au fost eliminate. Verificați celelalte afirmații în sursele furnizate.',
    },
    cs: {
        treatment: 'Bez aktuální etikety schválené ve vaší zemi a údajů o poli nemohu potvrdit dávku ani bezpečnou ochrannou lhůtu. Nepoužívejte neověřenou dávku. Uveďte zemi, plodinu a růstovou fázi, přípravek a etiketu nebo rozbor půdy pro hnojiva a vápno. Obraťte se na místního zemědělského poradce.',
        noEvidence: 'Nebyl nalezen vhodný zdroj. Jde o obecné rady, nikoli potvrzenou diagnózu nebo místně povolené ošetření.',
        invalidEvidence: 'Nepodložené odkazy byly odstraněny. Ostatní tvrzení ověřte v poskytnutých zdrojích.',
    },
    sk: {
        treatment: 'Bez aktuálnej etikety schválenej vo vašej krajine a údajov o poli nemôžem potvrdiť dávku ani bezpečnú ochrannú lehotu. Nepoužívajte neoverenú dávku. Uveďte krajinu, plodinu a rastovú fázu, prípravok a etiketu alebo rozbor pôdy pre hnojivá a vápno. Obráťte sa na miestneho poľnohospodárskeho poradcu.',
        noEvidence: 'Nenašiel sa vhodný zdroj. Ide o všeobecné rady, nie potvrdenú diagnózu alebo miestne povolené ošetrenie.',
        invalidEvidence: 'Nepodložené odkazy boli odstránené. Ostatné tvrdenia overte v poskytnutých zdrojoch.',
    },
    bg: {
        treatment: 'Без актуалния етикет, одобрен във вашата страна, и данни за полето не мога да потвърдя доза или безопасен карантинен срок. Не прилагайте непроверена доза. Посочете страна, култура и фаза, продукт и етикет или почвен анализ за торове и вар. Консултирайте се с местен земеделски съветник.',
        noEvidence: 'Не е намерен подходящ източник. Това са общи насоки, а не потвърдена диагноза или разрешено местно третиране.',
        invalidEvidence: 'Неподкрепените препратки са премахнати. Проверете останалите твърдения в предоставените източници.',
    },
    el: {
        treatment: 'Χωρίς την ισχύουσα εγκεκριμένη ετικέτα στη χώρα σας και τα δεδομένα του αγρού δεν μπορώ να επιβεβαιώσω δόση ή ασφαλές διάστημα αναμονής. Μην εφαρμόζετε μη επαληθευμένη δόση. Δώστε χώρα, καλλιέργεια και στάδιο, προϊόν και ετικέτα ή ανάλυση εδάφους για λιπάσματα και ασβέστη. Συμβουλευτείτε τοπικό γεωπόνο.',
        noEvidence: 'Δεν βρέθηκε κατάλληλη πηγή. Πρόκειται για γενικές οδηγίες, όχι επιβεβαιωμένη διάγνωση ή τοπικά εγκεκριμένη εφαρμογή.',
        invalidEvidence: 'Οι μη τεκμηριωμένες παραπομπές αφαιρέθηκαν. Ελέγξτε τους υπόλοιπους ισχυρισμούς στις παρεχόμενες πηγές.',
    },
    ug: {
        treatment: 'دۆلىتىڭىزدىكى ھازىر تەستىقلانغان مەھسۇلات بەلگىسى ۋە ئېتىز ئۇچۇرى بولمىسا، مىقدار ياكى بىخەتەر ئارىلىقنى جەزملەشتۈرەلمەيمەن. تەكشۈرۈلمىگەن مىقدارنى ئىشلەتمەڭ. دۆلەت، زىرائەت ۋە ئۆسۈش باسقۇچى، مەھسۇلات ۋە بەلگىسىنى؛ ئوغۇت ياكى ھاك ئۈچۈن تۇپراق تەكشۈرۈش نەتىجىسىنى تەمىنلەڭ. يەرلىك يېزا ئىگىلىك مەسلىھەتچىسىدىن سوراڭ.',
        noEvidence: 'مۇۋاپىق مەنبە تېپىلمىدى. بۇ ئادەتتىكى يېتەكچىلىك، جەزملەشتۈرۈلگەن دىئاگنوز ياكى يەرلىكتە تەستىقلانغان داۋالاش ئەمەس.',
        invalidEvidence: 'دەلىلسىز مەنبە كۆرسەتمىلىرى چىقىرىۋېتىلدى. قالغان قاراشلارنى تەمىنلەنگەن مەنبەلەردىن تەكشۈرۈڭ.',
    },
};

export function getAdvisoryMessages(language = 'en'): AdvisoryMessages {
    return translations[language.toLowerCase().split(/[-_]/)[0]!] || english;
}
