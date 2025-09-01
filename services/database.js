const { v4: uuidv4 } = require("uuid");

class DatabaseService {
  constructor(pool) {
    this.pool = pool;
  }

  async initialize() {
    // Create tables if they don't exist
    await this.createTables();
    await this.seedInitialData();
  }

  async createTables() {
    const createDoctorsTable = `
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
    `;

    const createPatientsTable = `
      CREATE TABLE IF NOT EXISTS patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        doctor_id VARCHAR(50) NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'next', 'consulting', 'completed', 'late')),
        estimated_duration INTEGER DEFAULT 15,
        joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        consultation_started_at TIMESTAMP,
        consultation_ended_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_patients_doctor_status ON patients(doctor_id, status);
      CREATE INDEX IF NOT EXISTS idx_patients_joined_at ON patients(joined_at);
      CREATE INDEX IF NOT EXISTS idx_doctors_available ON doctors(is_available);
    `;

    const createUpdateTrigger = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

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
    `;

    try {
      await this.pool.query(createDoctorsTable);
      await this.pool.query(createPatientsTable);
      await this.pool.query(createIndexes);
      await this.pool.query(createUpdateTrigger);
      console.log("Database tables created successfully");
    } catch (error) {
      console.error("Error creating database tables:", error);
      throw error;
    }
  }

  async seedInitialData() {
    const { rows: existingDoctors } = await this.pool.query(
      "SELECT COUNT(*) FROM doctors"
    );
    if (parseInt(existingDoctors[0].count) > 0) {
      console.log("Initial data already exists, skipping seed");
      return;
    }

    const doctors = [
      {
        id: "doc1",
        name: "Dr. Prince Bondzie",
        specialization: "General Medicine",
        is_available: true,
        average_consultation_time: 15,
        consultation_fee: 50.0,
        bio: "Experienced general practitioner with 10+ years of experience.",
      },
      {
        id: "doc2",
        name: "Dr. Yaw Asamoah",
        specialization: "Cardiology",
        is_available: true,
        average_consultation_time: 20,
        consultation_fee: 75.0,
        bio: "Cardiologist specializing in heart disease prevention and treatment.",
      },
      {
        id: "doc3",
        name: "Dr. Hughes Debazaa",
        specialization: "Pediatrics",
        is_available: false,
        average_consultation_time: 18,
        consultation_fee: 60.0,
        bio: "Pediatric specialist focused on child healthcare and development.",
      },
    ];

    const insertDoctorQuery = `
      INSERT INTO doctors (id, name, specialization, is_available, average_consultation_time, consultation_fee, bio)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    try {
      for (const doctor of doctors) {
        await this.pool.query(insertDoctorQuery, [
          doctor.id,
          doctor.name,
          doctor.specialization,
          doctor.is_available,
          doctor.average_consultation_time,
          doctor.consultation_fee,
          doctor.bio,
        ]);
      }
      console.log("Initial doctor data seeded successfully");
    } catch (error) {
      console.error("Error seeding initial data:", error);
      throw error;
    }
  }

  async getAllDoctors() {
    const { rows } = await this.pool.query(`
      SELECT d.*, 
             COUNT(CASE WHEN p.status != 'completed' THEN 1 END) as current_patient_count,
             COUNT(CASE WHEN p.status = 'waiting' THEN 1 END) as waiting_patient_count
      FROM doctors d
      LEFT JOIN patients p ON d.id = p.doctor_id
      GROUP BY d.id
      ORDER BY d.name
    `);
    return rows;
  }

  async getDoctorById(doctorId) {
    const { rows } = await this.pool.query(
      `
      SELECT d.*, 
             COUNT(CASE WHEN p.status != 'completed' THEN 1 END) as current_patient_count,
             COUNT(CASE WHEN p.status = 'waiting' THEN 1 END) as waiting_patient_count
      FROM doctors d
      LEFT JOIN patients p ON d.id = p.doctor_id
      WHERE d.id = $1
      GROUP BY d.id
    `,
      [doctorId]
    );
    return rows[0] || null;
  }

  async updateDoctorAvailability(doctorId, isAvailable) {
    const { rows } = await this.pool.query(
      "UPDATE doctors SET is_available = $1 WHERE id = $2 RETURNING *",
      [isAvailable, doctorId]
    );
    return rows[0];
  }

  // Patient operations
  async createPatient(patientData) {
    const { name, doctorId, estimatedDuration = 15 } = patientData;
    const { rows } = await this.pool.query(
      `
      INSERT INTO patients (name, doctor_id, estimated_duration, joined_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      RETURNING *
    `,
      [name, doctorId, estimatedDuration]
    );

    const patientWithDoctor = await this.getPatientById(rows[0].id);
    return patientWithDoctor;
  }

  async getPatientById(patientId) {
    const { rows } = await this.pool.query(
      `
      SELECT p.*, d.name as doctor_name, d.specialization, d.average_consultation_time
      FROM patients p
      JOIN doctors d ON p.doctor_id = d.id
      WHERE p.id = $1
    `,
      [patientId]
    );
    return rows[0] || null;
  }

  async updatePatientStatus(patientId, status, reason = "") {
    let updateFields = "status = $1";
    let params = [status, patientId];

    console.log("Update patient status called with:", {
      patientId,
      status,
      reason,
    });

    if (status === "consulting") {
      updateFields += ", consultation_started_at = CURRENT_TIMESTAMP";
    } else if (status === "completed") {
      updateFields += ", consultation_ended_at = CURRENT_TIMESTAMP";
    }

    console.log("Updating patient status:", { patientId, status, reason });

    const { rows } = await this.pool.query(
      `
      UPDATE patients SET ${updateFields} WHERE id = $2 RETURNING *
    `,
      params
    );
    return rows[0];
  }

  async removePatient(patientId) {
    const { rowCount } = await this.pool.query(
      "DELETE FROM patients WHERE id = $1",
      [patientId]
    );
    return rowCount > 0;
  }

  // Queue operations
  async getDoctorQueue(doctorId) {
    const { rows } = await this.pool.query(
      `
      SELECT p.*, d.name as doctor_name, d.specialization
      FROM patients p
      JOIN doctors d ON p.doctor_id = d.id
      WHERE p.doctor_id = $1
      ORDER BY p.joined_at ASC
    `,
      [doctorId]
    );
    return rows;
  }

  async getWaitingPatients(doctorId) {
    const { rows } = await this.pool.query(
      `
      SELECT p.*, d.name as doctor_name, d.specialization, d.average_consultation_time
      FROM patients p
      JOIN doctors d ON p.doctor_id = d.id
      WHERE p.doctor_id = $1 AND p.status = 'waiting'
      ORDER BY p.joined_at ASC
    `,
      [doctorId]
    );
    return rows;
  }

  async getPatientQueuePosition(patientId) {
    const patient = await this.getPatientById(patientId);
    if (!patient) return null;

    const { rows } = await this.pool.query(
      `
      SELECT COUNT(*) + 1 as position
      FROM patients
      WHERE doctor_id = $1 
        AND status = 'waiting' 
        AND joined_at < $2
    `,
      [patient.doctor_id, patient.joined_at]
    );

    return parseInt(rows[0].position);
  }

  // Statistics
  async getQueueStatistics(doctorId) {
    const { rows } = await this.pool.query(
      `
      SELECT 
        COUNT(*) as total_patients,
        COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_patients,
        COUNT(CASE WHEN status = 'consulting' THEN 1 END) as consulting_patients,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_patients,
        AVG(
          CASE 
            WHEN status = 'completed' AND consultation_started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (consultation_started_at - joined_at)) / 60
          END
        ) as average_wait_time
      FROM patients
      WHERE doctor_id = $1 AND DATE(created_at) = CURRENT_DATE
    `,
      [doctorId]
    );

    const stats = rows[0];
    return {
      totalPatients: parseInt(stats.total_patients) || 0,
      waitingPatients: parseInt(stats.waiting_patients) || 0,
      consultingPatients: parseInt(stats.consulting_patients) || 0,
      completedPatients: parseInt(stats.completed_patients) || 0,
      averageWaitTime: Math.round(parseFloat(stats.average_wait_time) || 0),
    };
  }

  async cleanupOldPatients() {
    const { rowCount } = await this.pool.query(`
      DELETE FROM patients 
      WHERE status = 'completed' 
        AND consultation_ended_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `);
    return rowCount;
  }

  async clearDoctorQueue(doctorId, statusFilter = "waiting") {
    const { rowCount } = await this.pool.query(
      `
      DELETE FROM patients 
      WHERE doctor_id = $1 AND status = $2
    `,
      [doctorId, statusFilter]
    );
    return rowCount;
  }

  async healthCheck() {
    try {
      const { rows } = await this.pool.query("SELECT NOW() as current_time");
      return {
        database: "connected",
        timestamp: rows[0].current_time,
      };
    } catch (error) {
      return {
        database: "disconnected",
        error: error.message,
      };
    }
  }
}

module.exports = DatabaseService;
