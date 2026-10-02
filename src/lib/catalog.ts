import type { Localized } from './i18n';

export interface ComponentDefinition {
  id: string;
  name: Localized;
  description: Localized;
  probe?: 'website' | 'login';
}
export interface ServiceGroup {
  id: string;
  name: Localized;
  subtitle: Localized;
  code: string;
  category: 'website' | 'network';
  components: ComponentDefinition[];
}
const text = (en: string, ru = en): Localized => ({ en, ru });
const protocols = (region: string): ComponentDefinition[] => [
  {
    id: `${region}-reality`,
    name: text('VLESS Reality'),
    description: text('Encrypted TCP transport', 'Шифрованное соединение по TCP')
  },
  {
    id: `${region}-hysteria2`,
    name: text('Hysteria2'),
    description: text('QUIC transport', 'Соединение по QUIC')
  },
  {
    id: `${region}-tuic`,
    name: text('TUIC v5'),
    description: text('QUIC relay', 'Передача трафика по QUIC')
  }
];
export const groups: ServiceGroup[] = [
  {
    id: 'web',
    name: text('Breach website', 'Сайт Breach'),
    subtitle: text('Your account, devices, and access', 'Кабинет, устройства и доступ'),
    code: 'WEB',
    category: 'website',
    components: [
      {
        id: 'website',
        name: text('Website', 'Сайт'),
        description: text('brea4.space'),
        probe: 'website'
      },
      {
        id: 'login',
        name: text('Sign-in page', 'Страница входа'),
        description: text(
          'Password sign-in page availability',
          'Доступность страницы входа по паролю'
        ),
        probe: 'login'
      },
      {
        id: 'account',
        name: text('Account & authentication', 'Кабинет и авторизация'),
        description: text('Sessions, passwords, and passkeys', 'Сессии, пароли и ключи доступа')
      },
      {
        id: 'devices',
        name: text('Devices & subscriptions', 'Устройства и подписки'),
        description: text(
          'Device setup and connection profiles',
          'Подключение устройств и профили соединения'
        )
      },
      {
        id: 'routing',
        name: text('Personal routing', 'Персональная маршрутизация'),
        description: text(
          'Routing rules and profile updates',
          'Правила маршрутизации и обновление профилей'
        )
      },
      {
        id: 'support',
        name: text('Support', 'Поддержка'),
        description: text('Support requests in your account', 'Обращения из личного кабинета')
      }
    ]
  },
  {
    id: 'moscow',
    name: text('Moscow', 'Москва'),
    subtitle: text('Control plane', 'Управление сетью'),
    code: 'RU',
    category: 'network',
    components: [
      {
        id: 'control-api',
        name: text('Management API', 'API управления'),
        description: text(
          'Device and connection management',
          'Управление устройствами и соединениями'
        )
      },
      {
        id: 'profile-delivery',
        name: text('Profile delivery', 'Доставка профилей'),
        description: text('Connection profile publication', 'Публикация профилей подключения')
      }
    ]
  },
  {
    id: 'amsterdam',
    name: text('Amsterdam', 'Амстердам'),
    subtitle: text('Netherlands · VPN edge', 'Нидерланды · VPN-узел'),
    code: 'NL',
    category: 'network',
    components: protocols('amsterdam')
  },
  {
    id: 'riga',
    name: text('Riga', 'Рига'),
    subtitle: text('Latvia · VPN edge', 'Латвия · VPN-узел'),
    code: 'LV',
    category: 'network',
    components: protocols('riga')
  }
];
export const componentIds = groups.flatMap((group) => group.components.map(({ id }) => id));
