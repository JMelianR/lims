-- =============================================================================
-- SEMILLA PARA PRUEBAS DE NOTIFICACIONES
-- =============================================================================
-- Crea datos mínimos para probar los 4 tipos de notificación:
--   1. sample_received     → al crear una muestra nueva
--   2. sample_status_change → al cambiar estado (cualquier cambio)
--   3. sample_completed    → al cambiar estado a "completed"
--   4. results_validated   → al validar un resultado
--
-- Requisito previo:
--   Tener un cliente con contact_email configurado (el tuyo para recibir los correos)
--   Tener n8n corriendo con el workflow importado
--   .env.local con N8N_NOTIFICATIONS_WEBHOOK_URL configurada
--
-- Uso:
--   1. Editar 'TU_EMAIL@example.com' y 'TU_CLIENT_ID' con tus valores reales
--   2. Ejecutar en SQL Editor de Supabase
-- =============================================================================

-- ⚠️ CAMBIAR estos valores antes de ejecutar
DO $$
DECLARE
    v_company_id UUID := 'b3b417bd-10bc-4343-b667-a2a0caffc6c0';
    v_client_id UUID := '4780aaac-63f1-448a-a384-71bcc5cdb586'; -- ⚠️ cambiar por tu cliente real
    v_test_email TEXT := 'TU_EMAIL@example.com';               -- ⚠️ cambiar por tu email real
    v_sample_id UUID;
    v_result_id UUID;
BEGIN
    -- 1. Actualizar el contact_email del cliente (para recibir notificaciones)
    UPDATE clients
    SET contact_email = v_test_email
    WHERE id = v_client_id;

    -- 2. Crear muestra de prueba (dispara sample_received al hacer POST desde la app)
    --    Esto solo crea los datos; la notificación se dispara desde la API
    INSERT INTO samples (company_id, client_id, code, species, variety, status, sla_type, sla_status, received_at, received_date)
    VALUES (v_company_id, v_client_id, 'TEST-NOTIF-001', 'Solanum lycopersicum', 'Roma', 'received', 'normal', 'on_time', NOW(), CURRENT_DATE)
    RETURNING id INTO v_sample_id;

    RAISE NOTICE '✅ Muestra creada: TEST-NOTIF-001 (id: %)', v_sample_id;
    RAISE NOTICE '';
    RAISE NOTICE '📋 Para probar las notificaciones:';
    RAISE NOTICE '  1. Abrí la app en http://localhost:3000';
    RAISE NOTICE '  2. Andá a Muestras → TEST-NOTIF-001 → Editar';
    RAISE NOTICE '  3. Cambiá el Estado a "En procesamiento" → Guardar (dispara sample_status_change)';
    RAISE NOTICE '  4. Cambiá el Estado a "Completada" → Guardar (dispara sample_completed)';
    RAISE NOTICE '  5. Andá a Resultados → Nueva → TEST-NOTIF-001 → Validar (dispara results_validated)';
    RAISE NOTICE '';
    RAISE NOTICE '📧 Revisá tu bandeja de entrada: %', v_test_email;
END $$;
