/**
 * The safety notice, in every language it has been reviewed in.
 *
 * Reviewed by native speakers in the organisation on 9 October 2026: Arabic,
 * Chinese (Simplified), French and Russian. Other languages fall back to
 * English until a translation has been checked - an unreviewed safety warning
 * can say something dangerous. Change these only through review.
 *
 * Rows are in the order of the review workbook (row 1 = title ... row 23).
 */

export type SafetyText = {
  /** Title, top of the screen. */
  title: string;
  /** First paragraph. */
  intro: string;
  risksHeading: string;
  risks: string;
  protectHeading: string;
  vpn: string;
  location: string;
  neverWrite: string;
  lockScreen: string;
  sharedDevice: string;
  tracesHeading: string;
  /** Website only, any device. */
  tracesWeb: string;
  /** Phone app only, in place of tracesWeb. */
  tracesApp: string;
  /** The notice's own Leave now button. */
  leaveNow: string;
  /** Under the Leave now button. */
  leaveNowDetail: string;
  understand: string;
  /** Under "I understand the risks". */
  notShownAgain: string;
  /** Label of the language switch. */
  language: string;
  /** The button on every screen of the website. */
  leaveNowButton: string;
  /** What screen readers say for leaveNowButton. */
  leaveNowLabel: string;
  /** Only while the website shows the button. */
  everyScreen: string;
  /** Computers only: beside the button on every screen. */
  shiftHint: string;
  /** Computers only: in the notice, after everyScreen. */
  shiftNotice: string;
};

/**
 * A left-to-right mark. In Arabic, "LGBTQ+" sits inside right-to-left text, and
 * without a strong character after it the "+" is pulled to the wrong side of
 * the acronym ("+LGBTQ").
 */
const LRM = '\u200E';

/**
 * A right-to-left mark at the start of every Arabic string. Android picks a
 * paragraph's direction from its first strong character, and the intro starts
 * with "LavenderBook" - so without this it would lay the sentence out
 * left-to-right. iOS and the web are told directly (writingDirection, dir), but
 * the mark costs nothing there.
 */
function rtl(text: SafetyText): SafetyText {
  return Object.fromEntries(
    Object.entries(text).map(([key, value]) => [key, `\u200F${value}`])
  ) as SafetyText;
}

/**
 * French typography: a no-break space before a colon and inside guillemets, a
 * narrow one before a semicolon, ! and ?, so none of them can start a line.
 * The reviewed text has plain spaces; the review sheet said the app would do it.
 */
function frenchSpacing(text: SafetyText): SafetyText {
  return Object.fromEntries(
    Object.entries(text).map(([key, value]) => [
      key,
      value
        .replace(/ ([:»])/g, '\u00A0$1')
        .replace(/« /g, '«\u00A0')
        .replace(/ ([;!?])/g, '\u202F$1'),
    ])
  ) as SafetyText;
}

const en: SafetyText = {
  title: 'Safety notice',
  intro:
    'LavenderBook is a guide to places that are safe for LGBTQ+ people. But in some countries, even opening or using it can be dangerous.',
  risksHeading: 'Possible risks',
  risks:
    "In some countries, being LGBTQ+, or using an app like this one, can lead to arrest, prosecution or violence. Police and border officers sometimes check people's phones, and apps and browsing history have been used as evidence.",
  protectHeading: 'How to protect yourself',
  vpn:
    "Use a trusted VPN or proxy, so your internet provider can't see you're using LavenderBook. Some countries restrict VPNs too, so first make sure it's safe where you are.",
  location: 'Turn off location, and choose a general area or a city for the map instead.',
  neverWrite: 'Never write names, dates, times or anything else that could identify you.',
  lockScreen:
    "Lock your screen whenever you put your phone down, and don't open LavenderBook where others can see your screen.",
  sharedDevice: 'On a shared device, always use a private or incognito window.',
  tracesHeading: "Traces we can't erase",
  tracesWeb:
    'No website can delete your browser history. Pressing "Leave now" signs you out and clears LavenderBook\'s data, but the visit stays in your browser\'s history. Delete it yourself in your browser\'s settings, or use a private window.',
  tracesApp:
    'Pressing "Leave now" signs you out and clears LavenderBook\'s data from this phone, but the app stays installed. If your phone may be searched, uninstall the app.',
  leaveNow: 'Leave now',
  leaveNowDetail:
    "Signs you out, clears the app's data from this device and switches to an everyday website.",
  understand: 'I understand the risks',
  notShownAgain: "This won't be shown again on this device.",
  language: 'Language',
  leaveNowButton: 'Leave now',
  leaveNowLabel:
    "Leave LavenderBook now: signs you out, clears the app's data from this device and switches to an everyday website.",
  everyScreen: 'The "Leave now" button is on every screen, so you can leave at any moment.',
  shiftHint: 'Or press Shift 3 times',
  shiftNotice: 'On a computer, you can also leave by pressing the Shift key 3 times in a row.',
};

const ar: SafetyText = rtl({
  title: 'تنبيه أمني',
  intro:
    `LavenderBook دليلٌ للأماكن الآمنة لأفراد مجتمع الميم (LGBTQ+${LRM}). لكن في بعض البلدان، قد يعرّضك مجرد فتح التطبيق أو استخدامه للخطر.`,
  risksHeading: 'مخاطر محتملة',
  risks:
    'في بعض البلدان، قد يؤدي الانتماء إلى مجتمع الميم، أو استخدام تطبيق كهذا، إلى الاعتقال أو الملاحقة القضائية أو التعرض للعنف. وقد تفتّش الشرطة أو سلطات الحدود الهواتف أحيانًا، وسبق أن استُخدمت التطبيقات وسجل التصفح أدلةً ضد أصحابها.',
  protectHeading: 'كيف تحمي نفسك',
  vpn:
    'استخدم شبكة VPN أو بروكسي موثوقًا، كي لا يتمكن مزوّد خدمة الإنترنت من معرفة أنك تستخدم LavenderBook. انتبه: بعض البلدان تقيّد شبكات VPN أيضًا، فتأكد أولًا من أن استخدامها آمن حيث تقيم.',
  location: 'أوقف خدمة تحديد الموقع، واختر بدلًا منها منطقة عامة أو مدينة لتظهر على الخريطة.',
  neverWrite: 'لا تكتب أبدًا أسماءً أو تواريخ أو أوقاتًا أو أي معلومة قد تكشف هويتك.',
  lockScreen:
    'أقفِل الشاشة كلما وضعت هاتفك جانبًا، ولا تفتح LavenderBook حيث يمكن للآخرين رؤية شاشتك.',
  sharedDevice: 'على الأجهزة المشتركة، استخدم دائمًا وضع التصفح الخاص (المتخفي).',
  tracesHeading: 'آثار لا يمكننا محوها',
  tracesWeb:
    'لا يمكن لأي موقع أن يمحو سجل التصفح في متصفحك. عند الضغط على «غادر الآن» يُسجَّل خروجك وتُمسح بيانات LavenderBook، لكن الزيارة تبقى في سجل المتصفح. احذفها بنفسك من إعدادات المتصفح، أو استخدم وضع التصفح الخاص.',
  tracesApp:
    'عند الضغط على «غادر الآن» يُسجَّل خروجك وتُمسح بيانات LavenderBook من هذا الهاتف، لكن التطبيق يبقى مثبّتًا. إن كان هاتفك معرّضًا للتفتيش، فاحذف التطبيق.',
  leaveNow: 'غادر الآن',
  leaveNowDetail: 'تسجيل الخروج، ومسح بيانات التطبيق من هذا الجهاز، والانتقال إلى موقع محايد.',
  understand: 'فهمتُ المخاطر',
  notShownAgain: 'لن تظهر هذه الرسالة مجددًا على هذا الجهاز.',
  language: 'اللغة',
  leaveNowButton: 'غادر الآن',
  leaveNowLabel:
    'غادر LavenderBook الآن: تسجيل الخروج، ومسح بيانات التطبيق من هذا الجهاز، والانتقال إلى موقع محايد.',
  everyScreen: 'زر «غادر الآن» متاح في كل شاشة، لتغادر في أي لحظة.',
  shiftHint: 'أو اضغط Shift ثلاث مرات متتالية',
  shiftNotice: 'على الحاسوب، يمكنك أيضًا المغادرة بالضغط على مفتاح Shift ثلاث مرات متتالية.',
});

const zh: SafetyText = {
  title: '安全提示',
  intro: 'LavenderBook 是一份为 LGBTQ+ 群体介绍安全场所的指南。但在某些国家，哪怕仅仅打开或使用本平台，也可能带来安全风险。',
  risksHeading: '潜在风险',
  risks: '在某些国家，身为 LGBTQ+ 或使用此类应用，可能导致被拘留、被起诉或遭受暴力。警察和边检人员有时会检查人们的手机，应用和浏览记录曾被用作证据。',
  protectHeading: '如何保护自身安全',
  vpn: '使用值得信赖的 VPN 或代理工具，避免网络运营商监测到你在访问 LavenderBook。部分国家对 VPN 同样有限制，请先确认在当地使用是否安全。',
  location: '关闭定位服务。建议改为手动选择大致区域。',
  neverWrite: '切勿留下真实姓名、具体日期、时间等任何可能暴露个人身份的信息。',
  lockScreen: '随手锁屏，切勿在旁人可能看到的场合打开 LavenderBook。',
  sharedDevice: '若使用共用设备，请务必开启无痕或隐私浏览窗口。',
  tracesHeading: '我们无法清除的痕迹',
  tracesWeb:
    '任何网站都无法远程清除你的浏览器历史。点击“立即离开”后，系统会退出登录并清除本站保存的数据，但浏览器仍会保留访问记录。请务必前往浏览器设置手动清理，或直接使用无痕窗口。',
  tracesApp: '点击“立即离开”后，系统会退出登录并清除本机上的使用数据，但应用仍会保留在手机上。如果手机面临被查验的风险，请直接卸载本应用。',
  leaveNow: '立即离开',
  leaveNowDetail: '退出登录，清除本机数据，并自动跳转至日常普通网页。',
  understand: '我已知晓风险',
  notShownAgain: '本设备将不再提示。',
  language: '语言',
  leaveNowButton: '立即离开',
  leaveNowLabel: '立即离开 LavenderBook：退出登录，清除本机数据，并自动跳转至日常普通网页。',
  everyScreen: '每个页面上都有“立即离开”按钮，你可以随时离开。',
  shiftHint: '或连按 3 次 Shift 键',
  shiftNotice: '在电脑上，你也可以快速连按 3 次 Shift 键离开。',
};

const fr: SafetyText = frenchSpacing({
  title: 'Avertissement de sécurité',
  intro:
    "LavenderBook est un guide des lieux sûrs pour les personnes LGBTQ+. Mais dans certains pays, le simple fait d'ouvrir ou d'utiliser cette application peut être dangereux.",
  risksHeading: 'Risques possibles',
  risks:
    "Dans certains pays, être LGBTQ+, ou utiliser une application comme celle-ci, peut conduire à une arrestation, à des poursuites ou à des violences. La police et les agents aux frontières fouillent parfois les téléphones, et des applications ou l'historique de navigation ont déjà servi de preuves.",
  protectHeading: 'Comment vous protéger',
  vpn:
    "Utilisez un VPN ou un proxy fiable, pour que votre fournisseur d'accès ne voie pas que vous consultez LavenderBook. Attention : certains pays restreignent aussi les VPN ; assurez-vous d'abord que c'est sans risque là où vous êtes.",
  location:
    'Désactivez la localisation et choisissez plutôt une zone générale ou une ville pour la carte.',
  neverWrite:
    "N'indiquez jamais de noms, de dates, d'heures ni aucune information qui permettrait de vous identifier.",
  lockScreen:
    "Verrouillez l'écran dès que vous posez votre téléphone, et n'ouvrez pas LavenderBook là où d'autres peuvent voir votre écran.",
  sharedDevice: 'Sur un appareil partagé, utilisez toujours la navigation privée.',
  tracesHeading: 'Les traces que nous ne pouvons pas effacer',
  tracesWeb:
    "Aucun site ne peut effacer l'historique de votre navigateur. Appuyer sur « Partir maintenant » vous déconnecte et efface les données de LavenderBook, mais la visite reste dans l'historique du navigateur. Effacez-la vous-même dans les paramètres du navigateur, ou utilisez la navigation privée.",
  tracesApp:
    "Appuyer sur « Partir maintenant » vous déconnecte et efface les données de LavenderBook sur ce téléphone, mais l'application reste installée. Si votre téléphone risque d'être fouillé, désinstallez-la.",
  leaveNow: 'Partir maintenant',
  leaveNowDetail:
    "Déconnexion, suppression des données de l'application sur cet appareil et redirection vers un site ordinaire.",
  understand: "J'ai compris les risques",
  notShownAgain: "Ce message ne s'affichera plus sur cet appareil.",
  language: 'Langue',
  leaveNowButton: 'Partir maintenant',
  leaveNowLabel:
    "Quitter LavenderBook maintenant : déconnexion, suppression des données de l'application sur cet appareil et redirection vers un site ordinaire.",
  everyScreen:
    'Le bouton « Partir maintenant » est présent sur chaque écran : vous pouvez partir à tout moment.',
  shiftHint: 'Ou appuyez 3 fois sur Maj',
  shiftNotice:
    'Sur ordinateur, vous pouvez aussi partir en appuyant 3 fois de suite sur la touche Maj (Shift).',
});

const ru: SafetyText = {
  title: 'Предупреждение о безопасности',
  intro:
    'LavenderBook — путеводитель по местам, безопасным для ЛГБТК+ людей. Но в некоторых странах опасно даже просто открывать это приложение или пользоваться им.',
  risksHeading: 'Возможные риски',
  risks:
    'В некоторых странах за принадлежность к ЛГБТК+ или использование подобных приложений могут задержать, привлечь к ответственности или подвергнуть насилию. Полиция и пограничники иногда проверяют телефоны, а приложения и история браузера уже использовались как доказательства.',
  protectHeading: 'Как защитить себя',
  vpn:
    'Пользуйтесь надёжным VPN или прокси, чтобы интернет-провайдер не видел, что вы заходите в LavenderBook. Учтите: в некоторых странах VPN тоже ограничены — заранее убедитесь, что там, где вы находитесь, это безопасно.',
  location: 'Отключите геолокацию и вместо неё выберите для карты общий район или город.',
  neverWrite:
    'Никогда не указывайте имена, даты, время и любые другие сведения, по которым вас можно идентифицировать.',
  lockScreen:
    'Блокируйте экран каждый раз, когда откладываете телефон, и не открывайте LavenderBook там, где другие могут видеть ваш экран.',
  sharedDevice: 'На общих устройствах всегда используйте режим инкогнито.',
  tracesHeading: 'Следы, которые мы не можем стереть',
  tracesWeb:
    'Ни один сайт не может удалить историю вашего браузера. Кнопка «Уйти сейчас» выведет вас из аккаунта и удалит данные LavenderBook, но посещение останется в истории браузера. Очистите её вручную в настройках браузера или пользуйтесь режимом инкогнито.',
  tracesApp:
    'Кнопка «Уйти сейчас» выведет вас из аккаунта и удалит данные LavenderBook с этого телефона, но само приложение останется установленным. Если ваш телефон могут проверить, удалите приложение.',
  leaveNow: 'Уйти сейчас',
  leaveNowDetail:
    'Выход из аккаунта, удаление данных приложения с устройства и переход на обычный сайт.',
  understand: 'Я понимаю риски',
  notShownAgain: 'На этом устройстве сообщение больше не появится.',
  language: 'Язык',
  leaveNowButton: 'Уйти сейчас',
  leaveNowLabel:
    'Уйти из LavenderBook: выход из аккаунта, удаление данных приложения с устройства и переход на обычный сайт.',
  everyScreen: 'Кнопка «Уйти сейчас» есть на каждом экране — уйти можно в любой момент.',
  shiftHint: 'Или трижды нажмите Shift',
  shiftNotice: 'На компьютере можно также уйти, быстро нажав Shift три раза подряд.',
};

export type SafetyLanguage = 'en' | 'ar' | 'zh' | 'fr' | 'ru';

type LanguageInfo = {
  /** The language's name in itself, for the switch. */
  name: string;
  /** BCP 47, for fonts and screen readers on the web. */
  tag: string;
  rtl: boolean;
  /**
   * Where "Leave now" goes: an everyday site in the language, chosen by its
   * reviewers. Ordinary enough that a glance at the screen gives nothing away,
   * reachable where its readers live, and not a site other quick-exit buttons
   * are known to use.
   */
  leaveTo: string;
  text: SafetyText;
};

export const SAFETY_LANGUAGES: Record<SafetyLanguage, LanguageInfo> = {
  en: { name: 'English', tag: 'en', rtl: false, leaveTo: 'https://www.google.com', text: en },
  ar: { name: 'العربية', tag: 'ar', rtl: true, leaveTo: 'https://www.google.com', text: ar },
  // Bilibili, not Baidu: the reviewer's pick, and what people actually have open.
  zh: { name: '简体中文', tag: 'zh-Hans', rtl: false, leaveTo: 'https://www.bilibili.com', text: zh },
  fr: { name: 'Français', tag: 'fr', rtl: false, leaveTo: 'https://www.google.com', text: fr },
  // Yandex, not Gismeteo: other exit buttons already send people to Gismeteo.
  ru: { name: 'Русский', tag: 'ru', rtl: false, leaveTo: 'https://ya.ru', text: ru },
};

/** The order of the language switch. */
export const SAFETY_LANGUAGE_ORDER: SafetyLanguage[] = ['en', 'ar', 'zh', 'fr', 'ru'];
