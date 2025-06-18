#include <Servo.h>

// Definición de servos
Servo servoMG995;     // Servo para el control de inclinación (MG995) - 0-180 grados
Servo servoDS04;      // Servo para el control de rotación (DS04) - 0-360 grados (simulado)

// Pines para los servos
const int SERVO_MG995_PIN = 9;  // Pin para servo MG995
const int SERVO_DS04_PIN = 10;  // Pin para servo DS04

// Evitar delay() excesivos
const int SHORT_DELAY = 50; // Reducir delays a 50ms máximo

// Estado de los servos
bool mg995_active = false;
bool ds04_active = false;



void setup() {
  Serial.begin(9600);
  
  // Inicializar pines pero no adjuntar los servos hasta que se necesiten
  // Esto evita que empiecen a moverse al encender
  pinMode(SERVO_MG995_PIN, OUTPUT);
  pinMode(SERVO_DS04_PIN, OUTPUT);
  
  Serial.println("Sistema de control de servos inicializado - Esperando comandos");
  Serial.println("Comandos: 'servo,tipo,on' para encender, 'servo,tipo,off' para apagar");
}

void loop() {
  // Procesar comandos seriales
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim(); // Eliminar espacios en blanco

    // Procesar solo si es un comando para servo
    if (command.startsWith("servo")) {
      procesarComandoServo(command);
    }
  }
}

// Procesar comandos para servos
// Buffers más pequeños y respuestas más rápidas
void procesarComandoServo(String command) {
  // Formato simplificado: servo,tipo,accion[,parametros]
  int firstComma = command.indexOf(',');
  if (firstComma == -1) return;
  
  String params = command.substring(firstComma + 1);
  int secondComma = params.indexOf(',');
  if (secondComma == -1) return;
  
  String servoType = params.substring(0, secondComma);
  String restCommand = params.substring(secondComma + 1);
  
  // Extraer acción y parámetros
  String action;
  int param = 0;
  
  int thirdComma = restCommand.indexOf(',');
  if (thirdComma != -1) {
    action = restCommand.substring(0, thirdComma);
    param = restCommand.substring(thirdComma + 1).toInt();
  } else {
    action = restCommand;
  }
  
  // Manejar comandos con respuestas mínimas
  if (servoType == "mg995") {
    if (action == "on") {
      servoMG995.attach(SERVO_MG995_PIN);
      servoMG995.write(90);
      Serial.println("mg995_on"); // Respuesta mínima
    } 
    else if (action == "off") {
      servoMG995.write(90);
      delay(SHORT_DELAY);
      servoMG995.detach();
      Serial.println("mg995_off");
    }
    else if (action == "move") {
      if (!servoMG995.attached()) {
        servoMG995.attach(SERVO_MG995_PIN);
      }
      servoMG995.write(param);
      Serial.println("mg995_moved");
    }
  } 
  else if (servoType == "ds04") {
    // Similar a MG995 pero para DS04
    if (action == "on") {
      servoDS04.attach(SERVO_DS04_PIN);
      servoDS04.write(90);
      Serial.println("ds04_on");
    } 
    else if (action == "off") {
      servoDS04.write(90);
      delay(SHORT_DELAY);
      servoDS04.detach();
      Serial.println("ds04_off");
    }
    else if (action == "move") {
      if (!servoDS04.attached()) {
        servoDS04.attach(SERVO_DS04_PIN);
      }
      servoDS04.write(param);
      Serial.println("ds04_moved");
    }
  }
}
