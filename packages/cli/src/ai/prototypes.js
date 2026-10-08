/**
 * A few ways people ask for each intent, in English and Spanish. The sentence encoder compares a request with these
 * when the lexical rules are not sure, and a request close to none of them is not something the CLI does.
 */
export const INTENT_PROTOTYPES = Object.freeze({
  create_project: [
    'create a new webapp for my company',
    'start a landing page for the product',
    'scaffold a microservice called billing',
    'crea una aplicación web nueva',
    'quiero un sitio web de presentación para mi producto',
  ],
  add_entity: [
    'add a CRUD to manage suppliers',
    'I need a list and a form to manage products',
    'agrega un CRUD de clientes',
    'necesito gestionar los proveedores con una lista',
  ],
  add_page: [
    'add a new page for reports',
    'create a pricing page',
    'agrega una página de reportes',
    'quiero una página nueva de precios',
  ],
  add_component: ['add a reusable component', 'create a widget for the dashboard', 'agrega un componente compartido'],
  add_service: [
    'add a backend service for invoices',
    'I need to call the backend for the orders',
    'agrega un servicio para consumir el backend de facturas',
  ],
  brand_colors: ['change the brand colours', 'make the header dark blue', 'cambia los colores de la marca'],
  images_generate: ['generate the hero image', 'make the share images', 'genera las imágenes del sitio'],
  services_add: [
    'connect the analytics service',
    'set up the image generation provider',
    'configura el despliegue en Cloudflare',
  ],
  update_stack: ['update the dependencies', 'upgrade to the latest stack', 'actualiza las dependencias del proyecto'],
  check_project: ['validate the project', 'run the quality checks', 'revisa que el proyecto esté bien'],
  add_section: [
    'add a frequently asked questions block to the home',
    'put a band with our customer logos',
    'agrega una sección de beneficios a la página de inicio',
    'quiero un bloque oscuro con tres tarjetas',
  ],
  add_blog_post: [
    'write a blog post about our launch',
    'publish a new article',
    'escribe una entrada del blog sobre el lanzamiento',
  ],
});

/**
 * Requests that are about something else. A request closer to these than to any intent is turned down: with a
 * sentence encoder trained on English, Spanish small talk scores high against everything, and only a comparison
 * tells it apart.
 */
export const OFF_TOPIC_PROTOTYPES = Object.freeze([
  'what is the weather today',
  'tell me a joke',
  'what is the capital of France',
  'how much is 15 times 12',
  'recommend me a movie',
  'book a flight to Madrid',
  'qué clima hace hoy',
  'cuéntame un chiste',
  'cuánto es dos más dos',
  'dame una receta de cocina',
  'recomiéndame una película o una serie',
  'cuál es la mejor pizza de la ciudad',
]);
