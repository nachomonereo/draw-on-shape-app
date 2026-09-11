# Draw on Shape - 3D Sculpting & Design App (Web & Android)

Aplicación de escultura 3D y dibujo sobre geometría interactiva, lista para ejecutar localmente en la Web y como **Aplicación Nativa de Android** con Capacitor.

---

## 🚀 Ejecución en Desarrollo (Web)

**Requisitos previos:** Node.js (v18+)

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

---

## 📱 Compilar y Ejecutar en Android

Esta aplicación está configurada con **Capacitor** para ejecutarse como aplicación nativa de Android.

### Requisitos previos para Android:
- **Android Studio** instalado (con Android SDK y Gradle).
- Java Development Kit (JDK 17 o superior).

### Pasos para compilar en Android:

1. **Compilar el proyecto web y sincronizar con Android:**
   ```bash
   npm run cap:sync
   ```

2. **Abrir el proyecto en Android Studio:**
   ```bash
   npm run cap:open
   ```
   *Alternativamente, abre directamente la carpeta `android` con Android Studio.*

3. **Generar APK o Ejecutar en Emulador/Dispositivo:**
   - En Android Studio, presiona **Run (Shift + F10)** para ejecutar en tu emulador o dispositivo físico conectado por USB.
   - Para generar un archivo **APK instalable**, ve al menú:
     `Build` > `Build Bundle(s) / APK(s)` > `Build APK(s)`.

---

## 🎨 Características Principales

- **Geometrías simplificadas**: Cubo, Esfera, Plano (Curve Guide) y Loft.
- **Plano (Curve Guide)**: Permite dibujar una curva libre en 3D que se proyecta en la dirección de la cámara con una longitud proporcional.
- **Trazado directo sobre geometría**: Dibujo de trazos precisos directamente sobre la superficie de objetos 3D sin proyección indeseada en el plano XY.
