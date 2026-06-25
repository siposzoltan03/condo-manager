"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Pencil } from "lucide-react";
import { UnitFormModal } from "./unit-form";

interface UnitData {
  id: string;
  number: string;
  floor: number;
  size: number;
  ownershipShare: number;
}

interface AddUnitButtonProps {
  totalOwnershipShare: number;
}

export function AddUnitButton({ totalOwnershipShare }: AddUnitButtonProps) {
  const tUnits = useTranslations("units");
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[#002045] px-6 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 transition-all"
      >
        <Plus className="h-4 w-4" />
        {tUnits("addUnit")}
      </button>
      {showModal && (
        <UnitFormModal
          unit={null}
          totalOwnershipShare={totalOwnershipShare}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

interface EditUnitButtonProps {
  unit: UnitData;
  totalOwnershipShare: number;
}

export function EditUnitButton({ unit, totalOwnershipShare }: EditUnitButtonProps) {
  const tUnits = useTranslations("units");
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="rounded-md p-2 text-[#515f74] hover:text-[#002045] transition-colors"
        title={tUnits("editUnit")}
      >
        <Pencil className="h-4 w-4" />
      </button>
      {showModal && (
        <UnitFormModal
          unit={unit}
          totalOwnershipShare={totalOwnershipShare}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
