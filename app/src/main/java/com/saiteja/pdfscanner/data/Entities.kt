package com.saiteja.pdfscanner.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.saiteja.pdfscanner.domain.PageFilter
import com.saiteja.pdfscanner.domain.PdfPageSize
import com.saiteja.pdfscanner.domain.Quad
import com.saiteja.pdfscanner.domain.ScanDocument
import com.saiteja.pdfscanner.domain.ScanPage

@Entity(tableName = "documents")
data class DocumentEntity(
    @PrimaryKey val id: String,
    val name: String,
    val createdAt: Long,
    val updatedAt: Long,
    val isDraft: Boolean,
    val pageSize: String,
)

@Entity(
    tableName = "pages",
    foreignKeys = [
        ForeignKey(
            entity = DocumentEntity::class,
            parentColumns = ["id"],
            childColumns = ["documentId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("documentId")],
)
data class PageEntity(
    @PrimaryKey val id: String,
    val documentId: String,
    val position: Int,
    val sourceFile: String,
    /** Normalized crop corners: "tlx,tly,trx,try,brx,bry,blx,bly". */
    val corners: String,
    val rotation: Int,
    val filter: String,
)

fun DocumentEntity.toDomain() = ScanDocument(
    id = id,
    name = name,
    createdAt = createdAt,
    updatedAt = updatedAt,
    isDraft = isDraft,
    pageSize = runCatching { PdfPageSize.valueOf(pageSize) }.getOrDefault(PdfPageSize.A4),
)

fun PageEntity.toDomain() = ScanPage(
    id = id,
    documentId = documentId,
    position = position,
    sourceFile = sourceFile,
    corners = Quad.fromStorage(corners) ?: Quad.FULL,
    rotation = ((rotation % 360) + 360) % 360,
    filter = runCatching { PageFilter.valueOf(filter) }.getOrDefault(PageFilter.ORIGINAL),
)

fun ScanPage.toEntity() = PageEntity(
    id = id,
    documentId = documentId,
    position = position,
    sourceFile = sourceFile,
    corners = corners.toStorage(),
    rotation = rotation,
    filter = filter.name,
)
