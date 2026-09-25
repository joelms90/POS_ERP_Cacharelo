import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Firestore, QueryDocumentSnapshot } from '@google-cloud/firestore';

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  inquiryType: string;
  status: string;
  createdAt: string;
}

@Injectable()
export class InquiriesService {
  private readonly db?: Firestore;

  constructor() {
    if (this.gcpIntegrationsEnabled()) {
      this.db = new Firestore({
        projectId: 'fresh-sensor-497515-d3',
      });
    }
  }

  async findAll(status?: string): Promise<Inquiry[]> {
    if (!this.db) {
      return [];
    }

    try {
      let query: any = this.db.collection('contact_inquiries');

      if (status) {
        query = query.where('status', '==', status);
      }

      query = query.orderBy('createdAt', 'desc');

      const snapshot = await query.get();
      const inquiries: Inquiry[] = [];

      snapshot.forEach((doc: QueryDocumentSnapshot) => {
        const data = doc.data();
        if (!data) return;

        let createdAtStr = new Date().toISOString();
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          createdAtStr = data.createdAt.toDate().toISOString();
        } else if (data.createdAt && typeof data.createdAt === 'string') {
          createdAtStr = data.createdAt;
        }

        inquiries.push({
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || null,
          subject: data.subject || '',
          message: data.message || '',
          inquiryType: data.inquiryType || 'general',
          status: data.status || 'pending',
          createdAt: createdAtStr,
        });
      });

      return inquiries;
    } catch (error) {
      console.error('Error fetching inquiries from Firestore:', error);
      throw new InternalServerErrorException(
        'No se pudieron obtener las consultas del servidor.',
      );
    }
  }

  async updateStatus(id: string, status: string): Promise<Inquiry> {
    if (!this.db) {
      throw new ServiceUnavailableException(
        'Firestore inquiries are disabled for local development. Set ENABLE_GCP_INTEGRATIONS=true to enable them.',
      );
    }

    try {
      const docRef = this.db.collection('contact_inquiries').doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundException(`La consulta con ID ${id} no existe.`);
      }

      await docRef.update({ status });

      const updatedDoc = await docRef.get();
      const data = updatedDoc.data();

      if (!data) {
        throw new NotFoundException(`La consulta con ID ${id} no tiene datos.`);
      }

      let createdAtStr = new Date().toISOString();
      if (data.createdAt && typeof data.createdAt.toDate === 'function') {
        createdAtStr = data.createdAt.toDate().toISOString();
      } else if (data.createdAt && typeof data.createdAt === 'string') {
        createdAtStr = data.createdAt;
      }

      return {
        id: updatedDoc.id,
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || null,
        subject: data.subject || '',
        message: data.message || '',
        inquiryType: data.inquiryType || 'general',
        status: data.status || 'pending',
        createdAt: createdAtStr,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error updating inquiry status in Firestore:', error);
      throw new InternalServerErrorException(
        'No se pudo actualizar el estado de la consulta.',
      );
    }
  }

  private gcpIntegrationsEnabled() {
    if (process.env.ENABLE_GCP_INTEGRATIONS === 'true') return true;
    if (process.env.ENABLE_GCP_INTEGRATIONS === 'false') return false;
    return process.env.NODE_ENV === 'production';
  }
}
