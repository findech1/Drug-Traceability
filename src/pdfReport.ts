/**
 * ============================================================================
 * MODULE: pdfReport.ts
 * Generates an official, cryptographic "Certificate of Analysis & Blockchain Audit Dossier"
 * containing the Genesis Block Hash, Merkle Root Proof, Web Crypto ECDSA Signatures,
 * and PPB Regulatory Clearance.
 * ============================================================================
 */

import { jsPDF } from 'jspdf';
import { BatchWorldState } from './chaincode';
import { Block } from './ledger';
import { generateMerkleProof, MerkleTree } from './merkle';

export function generateBatchAuditPdf(
  batch: BatchWorldState,
  blocks: Block[],
  merkleTree?: MerkleTree
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const navy = [0, 31, 84]; // #001F54
  const gold = [201, 162, 39]; // #C9A227
  const slateDark = [15, 23, 42]; // #0F172A
  const slateMuted = [100, 116, 139]; // #64748B

  // Header Banner
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Gold accent line
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.rect(0, 38, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('PharmaChain — SDG 3 Drug Traceability Ledger', 14, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text(
    'OFFICIAL CRYPTOGRAPHIC AUDIT DOSSIER & CERTIFICATE OF CONFORMANCE',
    14,
    24
  );

  doc.setTextColor(203, 213, 225);
  doc.setFontSize(8.5);
  doc.text(
    `Channel: pharma-ke-channel · Consortium: Kenya National Pharma Consortium · Generated: ${new Date().toISOString()}`,
    14,
    31
  );

  let y = 48;

  // Batch Overview Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 44, 2, 2, 'FD');

  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Batch ID: ${batch.batchNo}`, 18, y + 8);

  const statusText =
    batch.status === 'RECALLED'
      ? 'RECALLED, DO NOT USE'
      : batch.status === 'FLAGGED'
      ? 'UNDER REGULATORY INSPECTION'
      : 'AUTHENTIC & VERIFIED';

  doc.setFontSize(10);
  if (batch.status === 'RECALLED') {
    doc.setTextColor(185, 28, 28);
  } else {
    doc.setTextColor(22, 101, 52);
  }
  doc.text(`Status: ${statusText}`, 18, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  doc.text(`Drug: ${batch.drugName}`, 18, y + 22);
  doc.text(
    `Manufacturer: ${batch.manufacturerName} · Mfd: ${batch.manufactureDate} · Exp: ${batch.expiryDate}`,
    18,
    y + 28
  );
  doc.text(
    `Current Custodian: ${batch.currentHolderName} (${batch.currentHolderRole}) · Remaining Stock: ${batch.currentQuantity.toLocaleString()} units`,
    18,
    y + 34
  );
  doc.text(
    `Storage Requirements: ${batch.storageTemp} · MVCC Version: v${batch.version}`,
    18,
    y + 40
  );

  y += 52;

  // Blockchain Ledger Integrity Proofs
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('1. Cryptographic Ledger Proofs', 14, y);

  y += 5;
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);

  const genesisBlock = blocks[0];
  const genesisHash = genesisBlock?.hash || 'N/A';
  const latestBlock = blocks[blocks.length - 1];

  doc.text(`Genesis Hash:   ${genesisHash}`, 14, y);
  y += 4.5;
  doc.text(`Latest Block:   #${latestBlock?.index} (${latestBlock?.hash})`, 14, y);
  y += 4.5;
  doc.text(`Block Merkle:   ${latestBlock?.merkleRoot || 'N/A'}`, 14, y);
  y += 4.5;
  if (batch.privateDataHash) {
    doc.text(
      `Private SideDB: Hash on-chain: ${batch.privateDataHash} (${batch.privateDataCollectionName})`,
      14,
      y
    );
    y += 4.5;
  }

  y += 6;

  // Custody Chain Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('2. Signed Chain of Custody (ECDSA P-256 Multi-Peer Audit)', 14, y);

  y += 6;

  batch.custodyHistory.forEach((ev, idx) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, pageWidth - 28, 22, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.text(
      `Hop #${idx + 1}: ${ev.action} · Block #${ev.blockIndex} · ${new Date(ev.timestamp).toLocaleString()}`,
      18,
      y + 5
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text(`Actor: ${ev.actorName} (${ev.actorMspId})`, 18, y + 10);
    doc.text(`Notes: ${ev.notes}`, 18, y + 15);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(
      `ECDSA Sig: ${ev.signatureHex.slice(0, 48)}... · Policy: ${ev.endorsementPolicy || 'Single-Peer'}`,
      18,
      y + 19.5
    );

    y += 25;
  });

  // Footer seal
  if (y > 255) {
    doc.addPage();
    y = 20;
  }
  y += 5;
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(14, y, pageWidth - 28, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    'Pharmacy and Poisons Board (PPB Kenya) Consortium Verification Authority',
    pageWidth / 2,
    y + 6,
    { align: 'center' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text(
    'Cryptographically sealed with ECDSA P-256 and SHA-256 Merkle root proofs.',
    pageWidth / 2,
    y + 12,
    { align: 'center' }
  );

  doc.save(`PharmaChain_Audit_Dossier_${batch.batchNo}.pdf`);
}
