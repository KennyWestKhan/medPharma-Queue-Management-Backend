
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create doctors table
CREATE TABLE IF NOT EXISTS doctors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    is_available BOOLEAN DEFAULT true,
    average_consultation_time INTEGER DEFAULT 15,
    max_daily_patients INTEGER DEFAULT 50,
    consultation_fee DECIMAL(10,2),
    bio TEXT,
    profile_image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create patients table
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    doctor_id VARCHAR(50) NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'next', 'consulting', 'completed','late')),
    estimated_duration INTEGER DEFAULT 15,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    consultation_started_at TIMESTAMP,
    consultation_ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patients_doctor_status ON patients(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_patients_joined_at ON patients(joined_at);
CREATE INDEX IF NOT EXISTS idx_doctors_available ON doctors(is_available);
CREATE INDEX IF NOT EXISTS idx_patients_doctor_joined ON patients(doctor_id, joined_at);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_doctors_updated_at ON doctors;
CREATE TRIGGER update_doctors_updated_at
    BEFORE UPDATE ON doctors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample doctors with your custom names
INSERT INTO doctors (id, name, specialization, is_available, average_consultation_time, consultation_fee, bio) 
VALUES 
    ('doc1', 'Dr. Prince Bondzie', 'General Medicine', true, 15, 50.00, 'Experienced general practitioner with 10+ years of experience in family medicine and preventive care.'),
    ('doc2', 'Dr. Yaw Asamoah', 'Cardiology', true, 20, 75.00, 'Board-certified cardiologist specializing in heart disease prevention, diagnosis, and treatment.'),
    ('doc3', 'Dr. Hughes Debazaa', 'Pediatrics', false, 18, 60.00, 'Pediatric specialist focused on comprehensive healthcare for infants, children, and adolescents.'),
    ('doc4', 'Dr. Kiki Smith', 'Dermatology', true, 12, 65.00, 'Dermatologist with expertise in skin conditions, cosmetic procedures, and skin cancer prevention.'),
    ('doc5', 'Dr. Jemilu Mohammed', 'Internal Medicine', true, 16, 55.00, 'Internal medicine physician specializing in adult healthcare and chronic disease management.')
ON CONFLICT (id) DO NOTHING;

-- Insert sample patients for testing the queue functionality
INSERT INTO patients (id, name, doctor_id, status, estimated_duration, joined_at, consultation_started_at, consultation_ended_at) 
VALUES 
    -- Patients for Dr. Prince Bondzie (doc1) - Active queue
    (uuid_generate_v4(), 'Kwame Asante', 'doc1', 'waiting', 15, CURRENT_TIMESTAMP - INTERVAL '12 minutes', NULL, NULL),
    (uuid_generate_v4(), 'Akosua Mensah', 'doc1', 'waiting', 20, CURRENT_TIMESTAMP - INTERVAL '8 minutes', NULL, NULL),
    (uuid_generate_v4(), 'Kofi Darko', 'doc1', 'next', 15, CURRENT_TIMESTAMP - INTERVAL '5 minutes', NULL, NULL),
    (uuid_generate_v4(), 'Ama Owusu', 'doc1', 'completed', 18, CURRENT_TIMESTAMP - INTERVAL '45 minutes', CURRENT_TIMESTAMP - INTERVAL '25 minutes', CURRENT_TIMESTAMP - INTERVAL '7 minutes'),
    
    -- Patients for Dr. Yaw Asamoah (doc2) - Cardiology queue
    (uuid_generate_v4(), 'Kweku Boateng', 'doc2', 'consulting', 25, CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP - INTERVAL '10 minutes', NULL),
    (uuid_generate_v4(), 'Efua Addae', 'doc2', 'waiting', 20, CURRENT_TIMESTAMP - INTERVAL '6 minutes', NULL, NULL),
    (uuid_generate_v4(), 'Yaw Oppong', 'doc2', 'waiting', 22, CURRENT_TIMESTAMP - INTERVAL '3 minutes', NULL, NULL),
    
    -- Patients for Dr. Hughes Debazaa (doc3) - Pediatrics (doctor is unavailable, but has some completed consultations)
    (uuid_generate_v4(), 'Little Kojo Nkrumah', 'doc3', 'completed', 20, CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '1 hour 40 minutes', CURRENT_TIMESTAMP - INTERVAL '1 hour 20 minutes'),
    (uuid_generate_v4(), 'Baby Akua Sarpong', 'doc3', 'completed', 25, CURRENT_TIMESTAMP - INTERVAL '3 hours', CURRENT_TIMESTAMP - INTERVAL '2 hours 35 minutes', CURRENT_TIMESTAMP - INTERVAL '2 hours 10 minutes'),
    
    -- Patients for Dr. Kiki Smith (doc4) - Dermatology queue
    (uuid_generate_v4(), 'Nana Adjei', 'doc4', 'waiting', 12, CURRENT_TIMESTAMP - INTERVAL '4 minutes', NULL, NULL),
    (uuid_generate_v4(), 'Abena Frimpong', 'doc4', 'waiting', 15, CURRENT_TIMESTAMP - INTERVAL '2 minutes', NULL, NULL),
    (uuid_generate_v4(), 'Samuel Badu', 'doc4', 'completed', 10, CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '48 minutes', CURRENT_TIMESTAMP - INTERVAL '38 minutes'),
    
    -- Patients for Dr. Jemilu Mohammed (doc5) - Internal Medicine queue  
    (uuid_generate_v4(), 'Ibrahim Yakubu', 'doc5', 'waiting', 16, CURRENT_TIMESTAMP - INTERVAL '15 minutes', NULL, NULL),
    (uuid_generate_v4(), 'Fatima Alhassan', 'doc5', 'waiting', 18, CURRENT_TIMESTAMP - INTERVAL '10 minutes', NULL, NULL),
    (uuid_generate_v4(), 'Mohammed Issah', 'doc5', 'waiting', 20, CURRENT_TIMESTAMP - INTERVAL '7 minutes', NULL, NULL),
    (uuid_generate_v4(), 'Zainab Sulemana', 'doc5', 'next', 16, CURRENT_TIMESTAMP - INTERVAL '2 minutes', NULL, NULL);

-- Create a view for doctor statistics
CREATE OR REPLACE VIEW doctor_statistics AS
SELECT 
    d.id,
    d.name,
    d.specialization,
    d.is_available,
    d.average_consultation_time,
    COUNT(CASE WHEN p.status != 'completed' THEN 1 END) as current_patient_count,
    COUNT(CASE WHEN p.status = 'waiting' THEN 1 END) as waiting_patient_count,
    COUNT(CASE WHEN p.status = 'late' THEN 1 END) as late_patient_count,
    COUNT(CASE WHEN p.status = 'consulting' THEN 1 END) as consulting_patient_count,
    COUNT(CASE WHEN p.status = 'completed' AND DATE(p.created_at) = CURRENT_DATE THEN 1 END) as completed_today
FROM doctors d
LEFT JOIN patients p ON d.id = p.doctor_id
GROUP BY d.id, d.name, d.specialization, d.is_available, d.average_consultation_time;

-- Create a function to get queue position
CREATE OR REPLACE FUNCTION get_patient_queue_position(patient_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    patient_doctor_id VARCHAR(50);
    patient_joined_at TIMESTAMP;
    position INTEGER;
BEGIN
    -- Get patient's doctor and join time
    SELECT doctor_id, joined_at INTO patient_doctor_id, patient_joined_at
    FROM patients 
    WHERE id = patient_uuid AND status = 'waiting';
    
    -- If patient not found or not waiting, return 0
    IF patient_doctor_id IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Calculate position based on join time
    SELECT COUNT(*) + 1 INTO position
    FROM patients
    WHERE doctor_id = patient_doctor_id 
      AND status = 'waiting' 
      AND joined_at < patient_joined_at;
    
    RETURN position;
END;
$$ LANGUAGE plpgsql;

-- Create a helper function to display current queue status
CREATE OR REPLACE FUNCTION show_queue_status()
RETURNS TABLE (
    doctor_name TEXT,
    patient_name TEXT,
    status TEXT,
    queue_position INTEGER,
    waiting_minutes INTEGER,
    estimated_wait_time INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.name::TEXT as doctor_name,
        p.name::TEXT as patient_name,
        p.status::TEXT,
        CASE 
            WHEN p.status = 'waiting' THEN get_patient_queue_position(p.id)
            ELSE 0
        END as queue_position,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.joined_at))/60::INTEGER as waiting_minutes,
        CASE 
            WHEN p.status = 'waiting' THEN 
                (get_patient_queue_position(p.id) - 1) * d.average_consultation_time
            ELSE 0
        END as estimated_wait_time
    FROM patients p
    JOIN doctors d ON p.doctor_id = d.id
    WHERE p.status != 'completed'
    ORDER BY d.name, p.joined_at;
END;
$$ LANGUAGE plpgsql;

-- Create a function to clean up old completed consultations
CREATE OR REPLACE FUNCTION cleanup_old_consultations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM patients 
    WHERE status = 'completed' 
      AND consultation_ended_at < CURRENT_TIMESTAMP - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (if using separate user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO medp_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO medp_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO medp_user;

-- Display setup completion message
SELECT 'MedPharma Queue Management Database Setup Complete!' as message;
SELECT 'Sample doctors inserted: ' || COUNT(*) || ' doctors' as sample_data FROM doctors;
SELECT 'Sample patients inserted: ' || COUNT(*) || ' patients' as sample_patients FROM patients;

-- Show queue summary by doctor
SELECT 
    d.name as doctor_name,
    d.specialization,
    d.is_available,
    COUNT(p.id) as total_patients,
    COUNT(CASE WHEN p.status = 'waiting' THEN 1 END) as waiting,
    COUNT(CASE WHEN p.status = 'late' THEN 1 END) as late,
    COUNT(CASE WHEN p.status = 'next' THEN 1 END) as next_up,
    COUNT(CASE WHEN p.status = 'consulting' THEN 1 END) as consulting,
    COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed
FROM doctors d
LEFT JOIN patients p ON d.id = p.doctor_id
GROUP BY d.id, d.name, d.specialization, d.is_available
ORDER BY d.name;

-- Show current database info
SELECT 
    current_database() as database_name,
    current_user as current_user,
    version() as postgresql_version;