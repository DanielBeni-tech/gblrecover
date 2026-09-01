import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAgencies, listCentres } from "@/api/client";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";

export type OrgCascadeSingleValue = {
  centre: string;
  agence: string;
};

export type OrgCascadeMultiValue = {
  centres: string[];
  agences: string[];
};

type SingleProps = {
  mode?: "single";
  value: OrgCascadeSingleValue;
  onChange: (next: OrgCascadeSingleValue) => void;
  className?: string;
  centreClassName?: string;
  agenceClassName?: string;
};

type MultiProps = {
  mode: "multi";
  value: OrgCascadeMultiValue;
  onChange: (next: OrgCascadeMultiValue) => void;
  className?: string;
  centreClassName?: string;
  agenceClassName?: string;
};

type Props = SingleProps | MultiProps;

/**
 * Filtres organisationnels en cascade : Centre d'abord, puis Agences de ce centre.
 * Affiche nom_agence ; transmet id_agence (single) ou id_agence[] (multi).
 */
export function OrgCascadeFilters(props: Props) {
  const centresQ = useQuery({
    queryKey: ["centres-list"],
    queryFn: () => listCentres({ pageSize: 100 }),
    staleTime: 300_000,
  });

  const agencesQ = useQuery({
    queryKey: ["agences-list"],
    queryFn: () => listAgencies({ pageSize: 300 }),
    staleTime: 300_000,
  });

  const centres = useMemo(
    () => (centresQ.data ?? []).map((c) => c.nom_centre).sort((a, b) => a.localeCompare(b)),
    [centresQ.data],
  );

  const agencyLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agencesQ.data ?? []) {
      map.set(a.id_agence, a.nom_agence ?? a.id_agence);
    }
    return map;
  }, [agencesQ.data]);

  const selectedCentres = props.mode === "multi" ? props.value.centres : props.value.centre ? [props.value.centre] : [];

  const filteredAgencies = useMemo(() => {
    return (agencesQ.data ?? [])
      .filter((a) => selectedCentres.length === 0 || selectedCentres.includes(a.nom_centre))
      .sort((x, y) => (x.nom_agence ?? x.id_agence).localeCompare(y.nom_agence ?? y.id_agence));
  }, [agencesQ.data, selectedCentres]);

  if (props.mode === "multi") {
    const { value, onChange, className, centreClassName, agenceClassName } = props;
    return (
      <div className={className ?? "contents"}>
        <MultiSelect
          label="Centre"
          options={centres}
          selected={value.centres}
          onChange={(centresNext) => onChange({ centres: centresNext, agences: [] })}
          placeholder="Tous les centres"
          className={centreClassName ?? "min-w-[220px] flex-1"}
        />
        <MultiSelect
          label="Agence"
          options={filteredAgencies.map((a) => a.id_agence)}
          selected={value.agences}
          onChange={(agencesNext) => onChange({ centres: value.centres, agences: agencesNext })}
          getLabel={(id) => agencyLabelById.get(id) ?? id}
          placeholder={value.centres.length === 0 ? "Toutes les agences" : "Agences du centre"}
          className={agenceClassName ?? "min-w-[220px] flex-1"}
        />
      </div>
    );
  }

  const { value, onChange, centreClassName, agenceClassName } = props;

  return (
    <>
      <div className={centreClassName}>
        <Label htmlFor="org-centre">Centre de gestion</Label>
        <Select
          id="org-centre"
          value={value.centre}
          onChange={(e) => onChange({ centre: e.target.value, agence: "" })}
        >
          <option value="">Tous les centres</option>
          {centres.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <div className={agenceClassName}>
        <Label htmlFor="org-agence">Agence</Label>
        <Select
          id="org-agence"
          value={value.agence}
          onChange={(e) => onChange({ centre: value.centre, agence: e.target.value })}
          disabled={filteredAgencies.length === 0 && Boolean(value.centre)}
        >
          <option value="">
            {value.centre ? "Toutes les agences du centre" : "Toutes les agences"}
          </option>
          {filteredAgencies.map((a) => (
            <option key={a.id_agence} value={a.id_agence}>
              {a.nom_agence ?? a.id_agence}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}
