/** Matches backend DocumentVisibility */
export type DocumentVisibility =
  | "COMPANY_WIDE"
  | "SPECIFIC_DEPARTMENTS"
  | "SPECIFIC_ROLES"
  | "SPECIFIC_DEPARTMENTS_AND_ROLES";

export interface DocumentTagResponse {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string | null;
}

export interface DocumentResponse {
  id: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  categoryId?: string | null;
  description?: string | null;
  tags: DocumentTagResponse[];
  visibility: DocumentVisibility;
  /** 1–5: user level X thấy tài liệu khi minimumRoleLevel >= X */
  minimumRoleLevel?: number | null;
  accessibleDepartments?: number[] | null;
  accessibleRoles?: number[] | null;
  embeddingStatus: string;
  chunkCount?: number | null;
  uploadedAt: string;
  documentTitle?: string | null;
  uploadedBy?: string | null;
  uploadedByEmail?: string | null;
  uploadedByName?: string | null;
}

export interface DeletedDocumentResponse {
  id: string;
  originalFileName: string;
  documentTitle?: string | null;
  description?: string | null;
  uploadedAt: string;
  deletedBy?: string | null;
  deletedAt?: string | null;
}

export interface DocumentVersionResponse {
  versionId: string;
  documentId: string;
  versionNumber: number;
  versionNote?: string | null;
  createdAt: string;
}

export interface DocumentCategoryResponse {
  id: string;
  tenantId?: string;
  parentId?: string | null;
  name: string;
  code: string;
  description?: string | null;
  isActive?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string | null;
  children?: DocumentCategoryResponse[] | null;
}

/** Request: update document access */
export interface UpdateDocumentAccessRequest {
  visibility: DocumentVisibility;
  minimumRoleLevel: number;
  accessibleDepartments?: number[] | null;
  accessibleRoles?: number[] | null;
}

/** Request: create category */
export interface CreateDocumentCategoryRequest {
  name: string;
  code: string;
  description?: string | null;
  parentId?: string | null;
}

/** Request: update category */
export interface UpdateDocumentCategoryRequest {
  name: string;
  code: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean | null;
}

/** Request: create tag */
export interface CreateDocumentTagRequest {
  name: string;
  code: string;
  description?: string | null;
}

/** Request: update tag */
export interface UpdateDocumentTagRequest {
  name: string;
  code: string;
  description?: string | null;
  isActive?: boolean | null;
}
