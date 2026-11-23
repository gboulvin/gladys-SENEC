# SENEC.Home

Supervise y controle su batería **SENEC.Home** y su **SENEC.Wallbox** en
Gladys: nivel de batería, producción solar, consumo de la casa, intercambios
con la red, estado del sistema, carga de seguridad y modo de carga del
wallbox. Todo pasa **directamente por su red local**, mediante la misma API
que la interfaz web del sistema (`lala.cgi`): sin cuenta mein-senec.de, sin
nube, y los valores siguen llegando aunque Internet esté caído.

## Sistemas compatibles

- **SENEC.Home V3 hybrid / hybrid duo** (incluidas las versiones LFP);
- **SENEC.Home V2.1** y los SENEC.Home V2 recientes;
- los **SENEC.Wallbox** configurados en estos sistemas (hasta 4).

Los **SENEC.Home 4 / P4** no tienen API local: esta integración no es
compatible con ellos.

## Requisitos

1. Gladys debe alcanzar el sistema en la red local: abra
   `https://<dirección-del-senec>/` en un navegador, debe aparecer la página
   web del SENEC (el navegador avisa de un certificado autofirmado: es
   normal).
2. Asigne al sistema una **dirección IP fija** (basta con una reserva DHCP en
   su router).

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. En **Dirección del SENEC.Home**, introduzca su dirección IP, p. ej.
   `192.168.1.40`. Varios sistemas: sepárelos con comas.
3. **Protocolo**: deje **HTTPS** (firmware actual). Elija HTTP solo para un
   firmware antiguo que no responde por HTTPS.
4. **Intervalo de actualización**: frecuencia de lectura, 30 segundos por
   defecto (10 segundos como mínimo).
5. **Umbral de excedente solar**: la potencia inyectada a la red (W, 500 por
   defecto) a partir de la cual se activa el disparador «Comienza el
   excedente solar».
6. Guarde y pulse **Probar la conexión**: se muestran los sistemas que han
   respondido, con su modelo y sus wallbox, o el motivo del fallo.
7. Abra la pestaña **Descubrimiento** y añada el SENEC.Home y sus wallbox.

## Qué obtiene

**Un dispositivo SENEC.Home**, con el nombre de su modelo y número de serie:

| Funcionalidad                                          | Tipo                  |
| ------------------------------------------------------ | --------------------- |
| Nivel de batería (%)                                   | almacenamiento        |
| Potencia de carga / descarga de la batería (W)         | almacenamiento        |
| Producción solar (W)                                   | producción de energía |
| Consumo de la casa (W)                                 | consumo de la casa    |
| Potencia consumida de / inyectada a la red (W)         | red                   |
| Contadores de energía (kWh): solar, casa, red, batería | según el firmware \*  |
| Temperatura de la batería y de la carcasa (°C)         | sonda                 |
| Estado del sistema (texto SENEC, p. ej. `CHARGE`)      | texto                 |
| **Carga de seguridad** (interruptor)                   | controlable           |

\* Los firmware recientes (imagen NPU 2408 y posteriores) ya no publican los
contadores de energía: esas funcionalidades no aparecen entonces.

**Un dispositivo por SENEC.Wallbox**: potencia de carga (W), vehículo
conectado, estado del wallbox y el **modo de carga** controlable (Rápido,
Optimizado solar, Bloqueado).

La **carga de seguridad** carga la batería desde la red hasta el 100 % y la
mantiene: útil antes de un corte anunciado o en horas valle. Deténgala para
volver al funcionamiento normal.

Cada dispositivo muestra una insignia **local / inaccesible**.

## Escenas

Disparadores:

- **Batería SENEC llena** / **Batería SENEC vacía**;
- **Cambio de modo del SENEC**: carga, descarga, batería llena, batería
  vacía, en espera, carga de seguridad, mantenimiento, error, inaccesible…
  filtrable por nuevo modo; las variables `mode`, `previous_mode` y
  `state_name` (estado SENEC en bruto) están disponibles;
- **Comienza el excedente solar** / **Termina el excedente solar**, con la
  potencia inyectada (`export_power`);
- **Vehículo conectado a / desconectado de un SENEC.Wallbox**.

Acciones:

- **Leer un SENEC.Home**: lee los valores ahora y los pasa a las acciones
  siguientes (nivel de batería, producción, consumo, red, modo…);
- **Carga de seguridad SENEC**: iniciar o detener;
- **Modo de carga SENEC.Wallbox**: Rápido, Optimizado solar o Bloqueado.

Para un umbral sobre un valor (batería por encima del 80 %…), use el
disparador estándar **Cambio de estado de un dispositivo** de Gladys.

## Widgets del panel

- **SENEC.Home**: producción, casa, red, batería, indicador de nivel, curva
  del día, modo de funcionamiento y botón de carga de seguridad;
- **SENEC.Wallbox**: potencia de carga, vehículo, modo y un botón por modo de
  carga.

## Solución de problemas

- **«… does not answer»**: compruebe la dirección IP y que la página web del
  SENEC se abre desde la red de Gladys; pruebe el otro protocolo.
- **«… without a SENEC serial number»**: la dirección responde, pero no es un
  SENEC.Home compatible (o es un SENEC.Home 4).
- **Valores congelados**: el sistema acepta un número limitado de peticiones;
  no use un intervalo muy corto si otras herramientas también lo consultan.
- Los registros de la integración (página Supervisión de Gladys) detallan
  cada error.

## Privacidad y seguridad

La integración solo habla con su SENEC.Home, en su red local. No guarda nada
secreto. El certificado autofirmado del sistema no se verifica: no exponga
nunca el sistema a Internet.
