# Casos de uso de GAIA

## Regla común de atención

1. Confirmar la solicitud elegida y recopilar únicamente los datos del caso.
2. Resumir lo entendido y avisar: “Voy a escalar esta solicitud con el equipo responsable.”
3. Transferir a un agente con el servicio, plataforma, tipo de solicitud y detalle ya recopilados.
4. Cuando Zendesk cree el ticket, comunicar el número real: “Tu caso fue registrado como ticket #{{ticket.id}}.” Nunca inventar un número.
5. Si falta un dato obligatorio, pedirlo antes de escalar. No solicitar la cédula otra vez: GAIA ya la recibe como `external_id` y campo del ticket.

## Preguntas y escalamiento por grupo

| Caso de uso | Botón inicial | Segunda selección | Datos que GAIA debe pedir antes de escalar | Grupo de servicios cubiertos |
|---|---|---|---|---|
| Cambio de contraseña | Olvidé mi contraseña | Microsoft Office 365, App Corripio, IGC, Telynet, Microsoft Dynamics u otra aplicación | Plataforma, mensaje de error si existe, teléfono de contacto | Cambio de contraseña; Microsoft Office 365 Authenticator (MFA) |
| Solicitud de acceso | Necesito acceso | App Corripio, IGC, Office 365, Dynamics, carpetas compartidas, internet u otra aplicación | Plataforma o recurso, tipo de acceso requerido, área y aprobación si aplica | Creación de accesos Normal; IGC Asignar permisos; App Somos Corripio Solicitud acceso; Internet Acceso; Carpetas compartidas Permisos; Dynamics Asignar permisos; acceso Cereales; sistemas varios control de accesos; Creación de accesos Dynamics 365 |
| Reporte de falla | Reportar una falla | Internet, IGC, impresora, Office 365, Dynamics, Telynet, antivirus u otro | Plataforma/equipo, sede o ubicación, mensaje de error, desde cuándo y si afecta a más personas | Internet Falla; IGC Falla; impresora Reporte de Falla; Office 365 Falla; Dynamics Falla; Telynet Falla; App Somos Corripio Falla; CPU y Hand Held Reporte de Falla; Zendesk Falla; Base de Datos Falla; Flota averiada |
| Configuración y actualización | Configuración | Office 365, antivirus, impresora, equipo, Zendesk, flotas u otra plataforma | Plataforma o equipo, configuración solicitada, ubicación y detalle del cambio | Office 365 Configuración/Actualización/Firma/Licencia/Permisos a buzón/Acceso desde otro país; Antivirus Configuración/Actualización; impresora Configuración; Zendesk Configuración/Actualización; Flotas Configuración; Carpetas compartidas Configuración; Intranet Actualización; App Somos Corripio Actualización; Dynamics Configuración/Actualización |
| Equipo o dispositivo | Equipo o dispositivo | Laptop nueva, cambio, impresora, Hand Held, CPU o falla | Tipo de equipo, sede, usuario asignado, motivo y condición del equipo actual | Laptop Asignación; Solicitud de equipos Cambio; impresora Configuración/Falla; Hand Held Configuración/Falla; CPU Configuración/Falla; Asignación de equipo |
| Sistema o plataforma | Sistema o plataforma | IGC, Dynamics, Telynet, App Corripio, Base de Datos, Zendesk o sistema diverso | Sistema, necesidad concreta, impacto, datos no sensibles para reproducir el caso | IGC Requerimiento/Asesoría; Dynamics Requerimiento/Consulta; Telynet Carga Inicial/Consulta; Base de Datos Alterar objeto tabla/Mantenimiento de datos; sistemas varios otros; requerimiento TI |

## Catálogo de casos que deben crearse en Zendesk AI Agent

Crear un caso por cada fila usando el título exactamente como aparece. Todos deben terminar con la regla común de atención.

| Nombre del caso | Motivo de solicitud para Zendesk AI Agent |
|---|---|
| TI - IGC - Requerimiento de sistema | El usuario necesita una función, cambio o requerimiento en IGC. |
| TI - Cambio de contraseña | El usuario no puede acceder porque olvidó o necesita cambiar su contraseña. |
| TI - Impresora - Configuración | El usuario necesita configurar una impresora corporativa. |
| TI - Creación de accesos - Normal | El usuario solicita acceso estándar a un recurso corporativo. |
| TI - Internet - Falla | El usuario reporta que no tiene internet o la conexión presenta fallas. |
| TI - IGC - Falla | El usuario reporta un error o indisponibilidad en IGC. |
| TI - Impresora - Reporte de falla | El usuario reporta una impresora que no funciona correctamente. |
| TI - Microsoft Office 365 - Configuración | El usuario necesita configurar una función de Microsoft 365. |
| TI - Creación de accesos - Asignación de equipo | El usuario requiere acceso o asignación relacionada con un equipo. |
| TI - Internet - Acceso | El usuario necesita habilitar acceso a internet. |
| TI - Antivirus - Configuración | El usuario necesita instalar o configurar antivirus. |
| TI - Telynet - Carga inicial | El usuario requiere carga inicial o activación de Telynet. |
| TI - Microsoft Office 365 - Falla | El usuario reporta una falla de Microsoft 365. |
| TI - Flotas - Recarga de data | El usuario solicita recarga de data para flotas. |
| TI - Sistemas varios - Otros | El usuario tiene una solicitud tecnológica no clasificada. |
| TI - App Somos Corripio - Solicitud de acceso | El usuario solicita acceso a App Somos Corripio. |
| TI - IGC - Asignar permisos | El usuario necesita permisos específicos en IGC. |
| TI - Laptop - Asignación | El usuario solicita asignación de una laptop. |
| TI - Microsoft Dynamics - Falla | El usuario reporta una falla en Microsoft Dynamics. |
| TI - Antivirus - Actualización | El usuario necesita actualizar el antivirus. |
| TI - Base de Datos - Alterar tabla | El usuario solicita alterar una tabla de base de datos. |
| TI - Flotas - Asignación de flota | El usuario solicita asignación de una flota. |
| TI - Microsoft Office 365 - Licencia | El usuario solicita asignación o cambio de licencia. |
| TI - Base de Datos - Falla | El usuario reporta una falla de base de datos. |
| TI - Hand Held - Configuración | El usuario necesita configurar un Hand Held. |
| TI - Flotas - Cambio de flota | El usuario solicita cambio de flota. |
| TI - Flotas - Configuración | El usuario necesita configurar una flota. |
| TI - Creación de accesos - Dynamics 365 | El usuario solicita acceso a Dynamics 365. |
| TI - Microsoft Dynamics - Configuración | El usuario necesita configurar Microsoft Dynamics. |
| TI - IGC - Asesoría | El usuario solicita orientación sobre IGC. |
| TI - Requerimiento TI | El usuario tiene un requerimiento general de TI. |
| TI - Telynet - Falla | El usuario reporta una falla de Telynet. |
| TI - Microsoft Dynamics - Requerimiento | El usuario solicita una función o cambio en Dynamics. |
| TI - CPU - Configuración | El usuario necesita configurar una CPU o estación de trabajo. |
| TI - App Somos Corripio - Actualización | El usuario solicita actualizar App Somos Corripio. |
| TI - Creación de usuario a futuro | El usuario solicita crear un usuario para incorporación futura. |
| TI - Microsoft Office 365 - MFA | El usuario necesita ayuda con Microsoft Authenticator. |
| TI - Equipo - Cambio | El usuario solicita cambio de equipo. |
| TI - Microsoft Office 365 - Acceso desde otro país | El usuario solicita acceso desde un país distinto. |
| TI - Microsoft Dynamics - Permisos | El usuario solicita permisos en Dynamics. |
| TI - Microsoft Office 365 - Consulta | El usuario tiene una consulta sobre Microsoft 365. |
| TI - Microsoft Office 365 - Buzón | El usuario solicita permisos a un buzón. |
| TI - App Somos Corripio - Falla | El usuario reporta una falla de App Somos Corripio. |
| TI - CPU - Reporte de falla | El usuario reporta una falla de CPU. |
| TI - Carpetas compartidas - Permisos | El usuario solicita permisos a una carpeta compartida. |
| TI - Microsoft Dynamics - Actualización | El usuario solicita actualización de Dynamics. |
| TI - Hand Held - Reporte de falla | El usuario reporta una falla de Hand Held. |
| TI - Microsoft Dynamics - Consulta | El usuario tiene una consulta sobre Dynamics. |
| TI - Zendesk - Falla | El usuario reporta una falla en Zendesk. |
| TI - Acceso Cereales - Control de accesos | El usuario solicita control de accesos para Cereales. |
| TI - Sistemas varios - Control de accesos | El usuario solicita control de accesos para un sistema diverso. |
| TI - Telynet - Consulta | El usuario tiene una consulta sobre Telynet. |
| TI - Zendesk - Configuración | El usuario necesita configurar Zendesk. |
| TI - Carpetas compartidas - Configuración | El usuario necesita configurar una carpeta compartida. |
| TI - Flotas - Flota averiada | El usuario reporta una flota averiada. |
| TI - Intranet - Actualización | El usuario solicita actualizar la intranet. |
| TI - Base de Datos - Mantenimiento de datos | El usuario solicita mantenimiento de datos. |
| TI - Microsoft Office 365 - Firma | El usuario necesita configurar su firma de correo. |
| TI - Zendesk - Actualización | El usuario solicita actualizar Zendesk. |
