/**
 * Configuración de formularios (logs)
 * Cada formulario define sus campos y las columnas del CSV resultante.
 *
 * Los 5 logs de Auditorías XMT1 (destino_doca, fury, contenerizado, linehaul,
 * inbound_fm) se eliminaron al clonar este repo como base de Auditorias_SVC.
 * El nuevo log (escaneo de Shipment ID + comparación contra catálogo de
 * estatus ID/ESTATUS/OPTIMIZADA) se define aquí durante la fase de
 * construcción.
 */

const FORMS_CONFIG = {};

/**
 * Obtener todas las formas disponibles
 */
function getAllForms() {
  return Object.values(FORMS_CONFIG);
}

/**
 * Obtener una forma por su ID
 */
function getFormConfig(formId) {
  return FORMS_CONFIG[formId];
}
