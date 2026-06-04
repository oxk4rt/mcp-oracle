# Plan de capa de seguridad para credenciales del MCP Oracle

## Objetivo

Definir una estrategia profesional de securización para las credenciales usadas por el MCP Oracle, eliminando su almacenamiento en texto plano y estableciendo opciones viables de implantación.

## Situación actual

- El MCP se ejecuta con `bun`.
- La configuración actual puede incluir credenciales en `config.toml` o en variables de entorno definidas de forma estática.
- Ese enfoque expone secretos en texto plano en archivos de configuración o en entornos fácilmente inspeccionables.

## Riesgo principal

Guardar credenciales en texto plano implica:

- exposición accidental en Git, backups, capturas o compartición de archivos;
- lectura por otros usuarios o procesos con acceso al perfil;
- dificultad para rotación segura;
- falta de trazabilidad y gobierno del secreto.

## Principios de diseño

- No almacenar credenciales en texto plano persistente si existe una alternativa razonable.
- Separar configuración funcional de material secreto.
- Minimizar superficie de exposición en disco, memoria y logs.
- Facilitar rotación, revocación y operación por varios usuarios/equipos.
- Alinear la solución con capacidades reales del entorno Windows corporativo.

## Opciones profesionales de securización

## Opción 1. Gestor de credenciales del sistema operativo

### Descripción

Guardar usuario y contraseña en el almacén seguro del sistema operativo y hacer que el MCP las recupere en tiempo de ejecución.

En Windows, la opción natural es `Windows Credential Manager` o una abstracción equivalente soportada por una librería segura.

### Ventajas

- evita texto plano en `toml`, `json` o ficheros locales;
- usa mecanismos nativos del sistema;
- reduce exposición accidental;
- encaja bien en entornos de puesto corporativo Windows.

### Inconvenientes

- requiere implementar una capa de lectura de secretos;
- complica algo la portabilidad entre sistemas;
- necesita definir convención de nombres y bootstrap inicial.

### Recomendación

Es la mejor opción local para un despliegue individual o por puesto en Windows si no existe un vault corporativo ya estandarizado.

## Opción 2. Vault corporativo o gestor centralizado de secretos

### Descripción

Mover las credenciales a un gestor centralizado como `HashiCorp Vault`, `Azure Key Vault`, `AWS Secrets Manager` u otro servicio corporativo equivalente.

El MCP no guarda la contraseña: la solicita al vault durante el arranque o bajo demanda.

### Ventajas

- opción más profesional a nivel organizativo;
- rotación centralizada;
- control de acceso, auditoría y revocación;
- evita proliferación de secretos por equipo.

### Inconvenientes

- mayor complejidad de integración;
- dependencia de red y de identidad corporativa;
- puede ser excesivo para un MCP local pequeño si no existe infraestructura previa.

### Recomendación

Es la mejor opción si el entorno ya dispone de un gestor corporativo de secretos o si se prevé uso por varios desarrolladores/equipos.

## Opción 3. Variables de entorno inyectadas en tiempo de ejecución

### Descripción

No guardar secretos en archivos persistentes del repo ni del `config.toml`. Inyectarlos solo al lanzar el MCP desde un wrapper, script local o herramienta externa.

### Ventajas

- mejora inmediata frente a dejar contraseñas en ficheros versionables;
- implantación sencilla;
- no requiere cambio profundo inicial.

### Inconvenientes

- no elimina del todo el riesgo;
- las variables pueden quedar expuestas a procesos, historial, scripts o dumps;
- suele terminar derivando en otro fichero local con texto plano si no se disciplina bien.

### Recomendación

Aceptable como medida transitoria, no como solución final de seguridad fuerte.

## Opción 4. Fichero local cifrado con clave derivada o protegida por el sistema

### Descripción

Guardar los secretos en un fichero local cifrado y descifrarlos en runtime. La clave puede protegerse mediante DPAPI en Windows o mecanismo equivalente.

### Ventajas

- mejor que texto plano en `toml` o `json`;
- permite trabajo offline;
- desacopla secretos de la configuración funcional.

### Inconvenientes

- hay que proteger correctamente la clave;
- si la clave o el mecanismo de descifrado quedan mal diseñados, la mejora es aparente;
- añade complejidad operativa y de soporte.

### Recomendación

Válida si no hay vault corporativo y se quiere algo más fuerte que variables de entorno. En Windows, debe apoyarse en protección nativa del sistema, no en cifrado casero.

## Opción 5. Autenticación sin contraseña estática

### Descripción

Reducir o eliminar el uso de contraseñas persistentes:

- autenticación integrada si Oracle y el entorno lo permiten;
- cuentas técnicas con mecanismos de rotación automática;
- tokens efímeros o credenciales de corta duración si la infraestructura lo soporta.

### Ventajas

- reduce el problema raíz;
- minimiza exposición de secretos permanentes;
- mejora el gobierno de accesos.

### Inconvenientes

- depende mucho de la arquitectura Oracle y del entorno corporativo;
- puede requerir cambios fuera del MCP.

### Recomendación

Es la mejor línea estratégica a largo plazo, pero normalmente no es la primera mejora táctica.

## Opciones no recomendables como solución principal

### Guardar secretos en `~/.data`, `AppData` o un fichero fuera del repo

Mover secretos fuera del repo mejora organización y reduce fugas accidentales en Git, pero si siguen en texto plano no constituye una securización profesional real.

Solo cambia la ubicación del riesgo.

### Ofuscación simple o cifrado casero

No debe considerarse una medida seria. Sin gestión robusta de claves, termina siendo seguridad aparente.

## Arquitectura recomendada por nivel de madurez

## Nivel 1. Mejora rápida

- sacar credenciales del `config.toml`;
- no guardar secretos en el repo;
- inyectar variables de entorno solo en runtime;
- limpiar documentación y ejemplos para no mostrar contraseñas reales.

## Nivel 2. Solución profesional local en Windows

- mantener en `config.toml` solo metadatos no sensibles;
- guardar secretos en `Windows Credential Manager`;
- implementar un resolvedor de secretos en el MCP;
- mapear cada secreto con una convención estable:
  - `oracle/MCI/integracion/user`
  - `oracle/MCI/integracion/pass`

## Nivel 3. Solución corporativa

- integrar con vault centralizado;
- autenticar el acceso al vault con identidad de usuario o cuenta técnica;
- evitar cualquier secreto persistente local salvo caché controlada si aplica.

## Propuesta recomendada para este MCP

## Recomendación principal

Para este caso, la opción más equilibrada es:

1. Corto plazo:
   - retirar credenciales del `config.toml`;
   - usar variables de entorno solo como transición;
   - impedir ejemplos con secretos en documentación.

2. Medio plazo:
   - implementar soporte para `Windows Credential Manager` como backend principal local.

3. Largo plazo:
   - evaluar integración con un gestor corporativo de secretos si el MCP se extiende a más usuarios o entornos sensibles.

## Diseño técnico propuesto

### Separación de responsabilidades

- `projects.json`: solo topología funcional, host, puerto, servicio, aliases, schema por defecto.
- `config.toml`: solo comando, rutas y parámetros no sensibles.
- backend de secretos: usuario y contraseña.

### Resolución de secretos

El MCP debería resolver credenciales con una estrategia explícita y ordenada, por ejemplo:

1. Backend seguro configurado (`Windows Credential Manager` o vault).
2. Variables de entorno de runtime como fallback controlado.
3. Rechazo explícito si solo existe texto plano no permitido.

### Política de compatibilidad

- permitir un modo transitorio para no romper instalaciones existentes;
- emitir advertencias si se detectan secretos en texto plano;
- definir una fecha o versión objetivo para retirar ese soporte.

## Fases de implantación

## Fase 1. Endurecimiento inmediato

- inventariar dónde aparecen credenciales hoy;
- retirar secretos de `config.toml` y ejemplos locales;
- revisar `README`, `config.toml`, `claude-mcp-oracle.json` y documentación asociada;
- definir convención de naming de secretos.

## Fase 2. Backend seguro local

- implementar módulo de lectura de secretos;
- integrar con `Windows Credential Manager`;
- añadir manejo de errores claro cuando falten secretos;
- validar con `MCI/integracion` y otros proyectos reales del repo.

## Fase 3. Gobierno y operación

- documentar alta, baja y rotación de credenciales;
- definir procedimiento para onboarding de nuevos equipos;
- establecer qué trazas o logs nunca deben incluir secretos.

## Fase 4. Evolución corporativa

- evaluar si compensa pasar a vault centralizado;
- preparar una interfaz de backend de secretos para no acoplar el MCP a una sola solución.

## Criterios de aceptación

- ninguna credencial queda almacenada en texto plano en archivos del repo;
- `config.toml` no contiene usuario ni contraseña;
- la documentación no incluye secretos reales ni placeholders peligrosos;
- el MCP puede arrancar y resolver credenciales desde backend seguro;
- existe procedimiento claro de rotación;
- el fallback transitorio, si existe, está documentado y acotado.

## Riesgos y tradeoffs

- más seguridad implica más complejidad operativa;
- integrar un secret store local o corporativo requiere tiempo de desarrollo y soporte;
- retirar de golpe el texto plano puede romper instalaciones existentes si no se hace con transición;
- un backend solo Windows mejora mucho el caso actual, pero limita portabilidad si luego se quiere uso multiplataforma.

## Decisión recomendada

La decisión profesional para este MCP es:

- no usar `~/.data` o similar como solución principal si el contenido sigue en claro;
- adoptar `Windows Credential Manager` como solución local recomendada;
- dejar preparada una abstracción para vault corporativo en una fase posterior;
- mantener variables de entorno solo como mecanismo temporal o de compatibilidad.

## Resultado esperado

El MCP seguirá ejecutándose con `bun`, pero las credenciales dejarán de residir en `config.toml` o ficheros equivalentes en texto plano, pasando a una capa de secretos separada, más segura y operable.
