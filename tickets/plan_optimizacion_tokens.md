# Plan de optimización de tokens y payloads del MCP Oracle

## Objetivo

Reducir el consumo innecesario de tokens y el volumen de datos inyectados al contexto del modelo, sin degradar la utilidad funcional del MCP Oracle.

## Hallazgos detectados

### 1. `execute_query` trunca tarde

- La limitación `max_rows` se aplica después de recuperar el resultset completo.
- Eso no siempre dispara más tokens en la respuesta final, pero sí puede:
  - traer demasiadas filas desde Oracle;
  - ocupar memoria innecesaria en el proceso MCP;
  - serializar datos que luego se descartan.

### 2. Herramientas con salida no acotada

- `list_tables`
- `list_schemas`
- `get_relations`

Estas herramientas pueden generar respuestas muy grandes en esquemas amplios, porque hoy no aplican paginación ni límites estrictos de salida.

### 3. Todas las respuestas vuelven inline como texto

- El servidor devuelve el resultado como `text` dentro de la respuesta MCP.
- Si el payload es grande, entra directamente en el contexto del modelo.
- No existe una capa intermedia de resumen, paginación o fragmentación.

### 4. Guardar en disco no ahorra tokens por sí solo

- Volcar resultados a `md` o `json` local no consume tokens mientras no se lean.
- El coste aparece cuando el contenido se vuelve a inyectar en contexto.
- Si luego se lee entero, el ahorro es nulo o casi nulo.
- Solo hay beneficio si el fichero se usa para leer partes concretas, resumir o inspeccionar bajo demanda.

### 5. Falta estrategia de resumen por defecto

- Para operaciones de exploración o consultas amplias, el MCP devuelve contenido completo demasiado pronto.
- Faltan respuestas iniciales de tipo:
  - resumen;
  - conteo;
  - primera página;
  - indicadores de truncado y continuación.

## Principios de optimización

- Limitar datos en origen antes de cargarlos al proceso.
- No devolver al modelo más texto del necesario para la siguiente decisión.
- Priorizar resumen sobre volcado completo.
- Añadir límites duros de seguridad.
- Hacer explícito cuándo una respuesta está truncada.

## Mejoras propuestas

## Bloque 1. Limitar filas en origen

### Propuesta 1.1

Aplicar el límite de filas antes de traer el resultset completo.

Alternativas:

- reescribir la SQL envolviéndola con límite Oracle;
- usar capacidades del driver para cortar lectura;
- usar `resultSet` y leer solo el número necesario de filas.

### Propuesta 1.2

Definir un `max_rows` máximo absoluto a nivel servidor, no solo el que pida el usuario.

### Propuesta 1.3

Devolver metadatos de control consistentes:

- `requestedRowLimit`
- `appliedRowLimit`
- `returnedRowCount`
- `truncated`

## Bloque 2. Acotar herramientas de catálogo y exploración

### Propuesta 2.1

Introducir paginación o límite por defecto en:

- `list_tables`
- `list_schemas`
- `get_relations`

### Propuesta 2.2

Cambiar su contrato de salida para devolver primero:

- conteo total;
- subconjunto inicial;
- aviso de continuación o necesidad de filtro.

### Propuesta 2.3

En `get_relations`, evitar por defecto el barrido completo del esquema si no se especifica `table_name`, o imponer un límite explícito de tablas.

## Bloque 3. Respuestas más eficientes para el modelo

### Propuesta 3.1

Para consultas amplias, devolver primero un resumen estructurado:

- columnas;
- número de filas devueltas;
- primeras filas;
- indicadores de truncado.

### Propuesta 3.2

Separar modo exploración y modo extracción:

- modo exploración: respuestas pequeñas y guiadas;
- modo extracción: más volumen, pero con límites y confirmación contextual si aplica.

### Propuesta 3.3

Evitar ejemplos o respuestas con `SELECT *` cuando no sea necesario.

## Bloque 4. Uso inteligente de ficheros locales

### Propuesta 4.1

Si alguna vez se materializan resultados en disco, hacerlo solo para estos casos:

- auditoría local;
- inspección fuera del contexto del modelo;
- lectura parcial posterior;
- exportación manual por parte del usuario.

### Propuesta 4.2

No tratar `md` o `json` como optimización automática de tokens. Solo es útil si luego se consume de forma parcial o resumida.

## Bloque 5. Observabilidad mínima

### Propuesta 5.1

Añadir métricas o trazas internas de bajo coste sobre:

- filas recuperadas;
- filas devueltas;
- tamaño aproximado del payload;
- duración de la consulta.

### Propuesta 5.2

Usar esas métricas para identificar herramientas y consultas con peor comportamiento de contexto.

## Fases de implantación

## Fase 1. Corte de volumen en origen

- rediseñar `execute_query` para no recuperar todo el resultset si no hace falta;
- fijar un máximo absoluto de filas;
- informar siempre del truncado.

## Fase 2. Paginación de herramientas de exploración

- limitar `list_tables`, `list_schemas` y `get_relations`;
- introducir parámetros de página o límite;
- actualizar contrato de salida.

## Fase 3. Resumen por defecto

- devolver salidas pequeñas y accionables;
- reservar el detalle completo para casos justificados.

## Fase 4. Documentación y expectativas

- explicar claramente qué consume tokens y qué no;
- documentar que guardar en disco no equivale a ahorrar tokens;
- alinear ejemplos y documentación con el nuevo comportamiento.

## Criterios de aceptación

- ninguna herramienta devuelve salida masiva sin control;
- `execute_query` no trae por defecto un resultset completo para truncarlo después;
- todas las respuestas grandes incluyen indicadores de truncado;
- las herramientas de exploración tienen límites o paginación;
- el comportamiento real está documentado y es predecible.

## Prioridad recomendada

1. Corregir `execute_query`.
2. Limitar `list_tables`, `list_schemas` y `get_relations`.
3. Añadir formato de respuesta resumido y consistente.
4. Documentar la política de payloads y tokens.

## Resultado esperado

El MCP Oracle reducirá el volumen de datos movidos innecesariamente, enviará menos contenido al contexto del modelo y mantendrá respuestas más controladas, predecibles y sostenibles en coste.
