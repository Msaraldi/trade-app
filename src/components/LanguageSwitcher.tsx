import { useTranslation } from 'react-i18next';
import { languages, type Language } from '../i18n';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="flex items-center gap-1">
      {(Object.keys(languages) as Language[]).map((lang) => (
        <button
          key={lang}
          onClick={() => changeLanguage(lang)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            i18n.language === lang
              ? 'bg-primary-600 text-white'
              : 'bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-white'
          }`}
          title={languages[lang].nativeName}
        >
          <span className="mr-1.5">{languages[lang].flag}</span>
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
