# ZEIF

Zeif es una solución de seguridad inteligente para grandes cadenas, que transforma las cámaras existentes en detectores de hurto en tiempo real.

Sin reemplazar infraestructura, sin agregar hardware: cada cámara del local analiza el comportamiento de los clientes con inteligencia artificial y alerta automáticamente cuando detecta una situación de riesgo.

Escalable a cientos de sucursales, mantiene una visibilidad centralizada en un solo dashboard.

En menos de 24 horas, las cámaras que ya tenés empiezan a trabajar para vos. Con Zeif, cada sucursal se vuelve más inteligente sola

___________________________________________________

**Equipo:** Skynet

**Integrantes:** Candela Mena, Cielo Dahy, Julian Melmer Stiefkens y Valentina Laura Correa

**Video:** 

**Deploy:** [https://zeif.vercel.app](https://zeif.vercel.app/)

**Ejecución:** npm run dev

**Implementación:** Zeif implementa un pipeline de clasificación de video en tiempo real orientado a la detección proactiva de eventos de seguridad, sin requerir intervención humana continua. 
Cada frame capturado pasa primero por un adaptador que normaliza el input independientemente del hardware de cámara utilizado, manteniendo el núcleo del sistema libre de dependencias. El frame normalizado ingresa al pipeline 
de clasificación, donde Gemini evalúa el contenido visual.           
                                                                                                                                                                                              
