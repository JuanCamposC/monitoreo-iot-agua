import { useEffect, useState, useCallback, useRef } from 'react';
import mqtt from 'mqtt';

interface MQTTOptions {
  brokerUrl: string;
  topics: string[];
  clientId?: string;
}

export const useMQTT = ({ brokerUrl, topics, clientId }: MQTTOptions) => {
  const [client, setClient] = useState<mqtt.MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  
  const clientRef = useRef<mqtt.MqttClient | null>(null);

  useEffect(() => {
    const connectMQTT = () => {
      try {
        const mqttClient = mqtt.connect(brokerUrl, {
          clientId: clientId || `nextjs_client_${Math.random().toString(16).substr(2, 8)}`,
          clean: true,
          connectTimeout: 10000,     // Aumentar timeout
          reconnectPeriod: 5000,     // Intentar reconectar cada 5 segundos
          keepalive: 60,
          rejectUnauthorized: false, // Para desarrollo
          protocol: 'wss',          // Forzar WebSocket seguro
          protocolVersion: 4,       // MQTT 3.1.1
        });

        mqttClient.on('connect', (connack) => {
          console.log('✅ Conectado a MQTT broker:', connack);
          setIsConnected(true);
          setError(null);
          
          // Suscribirse a los tópicos
          topics.forEach(topic => {
            console.log(`Intentando suscribirse a: ${topic}`);
            mqttClient.subscribe(topic, { qos: 0 }, (err, granted) => {
              if (err) {
                console.error(`❌ Error suscribiéndose a ${topic}:`, err);
                setError(`Error suscribiéndose a ${topic}: ${err.message}`);
              } else {
                console.log(`✅ Suscrito exitosamente a: ${topic}`, granted);
              }
            });
          });
        });

        mqttClient.on('reconnect', () => {
          console.log('🔄 Intentando reconectar...');
          setError('Reconectando...');
        });

        mqttClient.on('error', (err) => {
          console.error('❌ Error MQTT:', err);
          setError(err.message);
          setIsConnected(false);
        });

        mqttClient.on('message', (topic, message) => {
          try {
            const parsedMessage = JSON.parse(message.toString());
            console.log(`📨 Mensaje recibido en ${topic}:`, parsedMessage);
            setMessages(prev => ({
              ...prev,
              [topic]: parsedMessage
            }));
          } catch (e) {
            console.error('Error parsing message:', e);
          }
        });

        mqttClient.on('close', () => {
          console.log('🔴 Conexión MQTT cerrada');
          setIsConnected(false);
        });

        mqttClient.on('offline', () => {
          console.log('📴 Cliente MQTT offline');
          setIsConnected(false);
        });

        clientRef.current = mqttClient;
        setClient(mqttClient);
        
      } catch (err) {
        console.error('Error conectando a MQTT:', err);
        setError('Error conectando a MQTT broker');
      }
    };

    connectMQTT();

    return () => {
      if (clientRef.current) {
        console.log('🔌 Desconectando cliente MQTT...');
        clientRef.current.end(true);
      }
    };
  }, [brokerUrl, clientId]);

  const publishMessage = useCallback((topic: string, message: any) => {
    if (client && isConnected) {
      const payload = JSON.stringify(message);
      client.publish(topic, payload, { qos: 0 }, (err) => {
        if (err) {
          console.error(`Error publicando en ${topic}:`, err);
        } else {
          console.log(`📤 Mensaje publicado en ${topic}:`, message);
        }
      });
    } else {
      console.error('Cliente MQTT no conectado');
      setError('Cliente MQTT no conectado');
    }
  }, [client, isConnected]);

  const requestSensorData = useCallback((sensorType: string) => {
    const clientId = client?.options?.clientId || 'unknown';
    const requestMessage = {
      type: 'get',
      sensor: sensorType,
      client_id: clientId,
      timestamp: new Date().toISOString()
    };
    
    publishMessage(`tu_proyecto/${sensorType}/request`, requestMessage);
  }, [publishMessage, client]);

  return {
    client,
    isConnected,
    messages,
    error,
    publishMessage,
    requestSensorData
  };
};