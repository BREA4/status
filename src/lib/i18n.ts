export type Locale = 'en' | 'ru';

export function detectLocale(saved: string | undefined, acceptLanguage: string): Locale {
  if (saved === 'en' || saved === 'ru') return saved;
  const preferences = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [language, ...parameters] = part.trim().toLowerCase().split(';');
      const q = parameters.find((parameter) => parameter.trim().startsWith('q='));
      return {
        language: language.split('-')[0],
        quality: q ? Number(q.trim().slice(2)) : 1,
        index
      };
    })
    .filter(({ quality }) => Number.isFinite(quality) && quality > 0 && quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return (
    (preferences.find(({ language }) => language === 'en' || language === 'ru')
      ?.language as Locale) || 'en'
  );
}

const en = {
  statusPage: 'System status',
  back: 'Open Breach',
  skip: 'Skip to service status',
  networkStatus: 'Breach network status',
  headline: {
    operational: 'All systems operational.',
    degraded: 'Some services are degraded.',
    partial_outage: 'Some services are unavailable.',
    outage: 'A service interruption is ongoing.',
    maintenance: 'Maintenance is in progress.',
    unknown: 'Some status data is unavailable.'
  },
  intro:
    'A live view of the network you rely on. Check connections, services, and recent updates in one place.',
  services: 'Services',
  incidents: 'Incident history',
  refresh: 'Refresh status',
  refreshing: 'Checking…',
  checked: 'Last checked',
  noCheck: 'Awaiting first check',
  autoRefresh: 'Updates every 60 seconds',
  live: 'Live checks',
  partialCoverage: 'Partial monitoring coverage',
  offline: 'Unable to refresh. Showing the last available check.',
  stale: 'These checks are out of date. Current availability is unknown.',
  overview: 'Across the network',
  serviceIntro: 'Select a location or service to see its components.',
  all: 'All services',
  website: 'Website',
  network: 'Network',
  expand: 'Expand all',
  collapse: 'Collapse all',
  components: 'components',
  current: 'Current status',
  availability: 'Availability',
  history: '90-day history',
  today: 'Today',
  daysAgo: '90 days ago',
  noHistory: 'No recorded history',
  noMeasurement: 'No measurement',
  measured: 'measured uptime',
  unknownNote: 'No current monitoring data for this component.',
  reachability:
    'Public HTTP check. This confirms reachability, not a complete sign-in or account workflow.',
  probeNote:
    'Public checks cover the website and sign-in page. Account functions and VPN protocols require their own checks.',
  status: {
    operational: 'Operational',
    degraded: 'Degraded',
    partial_outage: 'Partial outage',
    outage: 'Outage',
    maintenance: 'Maintenance',
    unknown: 'No data'
  },
  incidentIntro: 'Service interruptions and maintenance updates.',
  active: 'Active',
  resolved: 'Resolved',
  noIncidents: 'No published incidents',
  noIncidentsNote:
    'There are no incident reports in the connected record. This does not imply uninterrupted uptime.',
  previous: 'Previous',
  next: 'Next',
  page: 'Page',
  of: 'of',
  updated: 'Updated',
  incidentState: {
    investigating: 'Investigating',
    identified: 'Identified',
    monitoring: 'Monitoring',
    resolved: 'Resolved',
    scheduled: 'Scheduled',
    maintenance: 'Maintenance'
  },
  supportHeading: 'Having trouble connecting?',
  supportCopy:
    'Your connection can be affected even when a service is available. Contact us from your Breach account.',
  support: 'Get support',
  footer: 'Breach. Stay connected.',
  timeZone: 'Times shown in your local timezone.',
  api: 'Status API',
  language: 'Language',
  legend: 'Status legend',
  monitoring: 'Monitoring coverage',
  coverageSuffix: 'components reporting',
  lastObservation: 'Last observation',
  close: 'Close',
  historyHint:
    'Daily availability appears when measured history is connected. Empty days have no data.',
  region: 'Region',
  protocol: 'Protocol',
  noMatches: 'No services in this view.'
};
const ru: typeof en = {
  statusPage: 'Статус системы',
  back: 'Открыть Breach',
  skip: 'Перейти к статусу сервисов',
  networkStatus: 'Статус сети Breach',
  headline: {
    operational: 'Все системы работают.',
    degraded: 'Некоторые сервисы работают со сбоями.',
    partial_outage: 'Некоторые сервисы недоступны.',
    outage: 'В работе сервиса произошел сбой.',
    maintenance: 'Идут технические работы.',
    unknown: 'Часть данных о статусе недоступна.'
  },
  intro:
    'Текущее состояние вашей сети. Подключения, сервисы и последние обновления на одной странице.',
  services: 'Сервисы',
  incidents: 'История сбоев',
  refresh: 'Обновить статус',
  refreshing: 'Проверяем…',
  checked: 'Последняя проверка',
  noCheck: 'Ожидаем первую проверку',
  autoRefresh: 'Обновление каждые 60 секунд',
  live: 'Текущие проверки',
  partialCoverage: 'Мониторинг охватывает не все сервисы',
  offline: 'Не удалось обновить данные. Показываем последнюю проверку.',
  stale: 'Данные проверок устарели. Текущая доступность неизвестна.',
  overview: 'Состояние сети',
  serviceIntro: 'Выберите регион или сервис, чтобы посмотреть его компоненты.',
  all: 'Все сервисы',
  website: 'Сайт',
  network: 'Сеть',
  expand: 'Раскрыть все',
  collapse: 'Свернуть все',
  components: 'компонентов',
  current: 'Текущий статус',
  availability: 'Доступность',
  history: 'История за 90 дней',
  today: 'Сегодня',
  daysAgo: '90 дней назад',
  noHistory: 'Истории пока нет',
  noMeasurement: 'Нет измерений',
  measured: 'измеренная доступность',
  unknownNote: 'Для этого компонента пока нет актуальных данных мониторинга.',
  reachability:
    'Проверка по HTTP подтверждает доступность страницы, но не полный сценарий входа или работу кабинета.',
  probeNote:
    'Проверки охватывают сайт и страницу входа. Функциям кабинета и протоколам VPN нужны отдельные проверки.',
  status: {
    operational: 'Работает',
    degraded: 'Работает со сбоями',
    partial_outage: 'Частичный сбой',
    outage: 'Недоступен',
    maintenance: 'Технические работы',
    unknown: 'Нет данных'
  },
  incidentIntro: 'Сообщения о сбоях и технических работах.',
  active: 'Текущие',
  resolved: 'Завершенные',
  noIncidents: 'Сообщений о сбоях пока нет',
  noIncidentsNote:
    'В подключенной истории нет сообщений об инцидентах. Это не означает, что сбоев не было.',
  previous: 'Назад',
  next: 'Далее',
  page: 'Страница',
  of: 'из',
  updated: 'Обновлено',
  incidentState: {
    investigating: 'Выясняем причину',
    identified: 'Причина найдена',
    monitoring: 'Наблюдаем',
    resolved: 'Устранено',
    scheduled: 'Запланировано',
    maintenance: 'Технические работы'
  },
  supportHeading: 'Не удается подключиться?',
  supportCopy:
    'Проблемы с подключением возможны и при доступном сервисе. Напишите нам из личного кабинета Breach.',
  support: 'Написать в поддержку',
  footer: 'Breach. Оставайтесь на связи.',
  timeZone: 'Время указано в вашем часовом поясе.',
  api: 'API статуса',
  language: 'Язык',
  legend: 'Обозначения',
  monitoring: 'Охват мониторинга',
  coverageSuffix: 'компонентов передают данные',
  lastObservation: 'Последнее наблюдение',
  close: 'Закрыть',
  historyHint:
    'Доступность по дням появится после подключения истории измерений. Пустые дни означают отсутствие данных.',
  region: 'Регион',
  protocol: 'Протокол',
  noMatches: 'В этой категории нет сервисов.'
};
export const messages = { en, ru };
export type Localized = { en: string; ru: string };
