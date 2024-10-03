/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { FeatureCollection } from "geojson";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

import "./styles.css";
import { MapPin } from "lucide-react";

type Coordinate = number[][];

const VITE_MAPBOX_ACCESS_TOKEN = import.meta.env
  .VITE_MAPBOX_ACCESS_TOKEN as string;

const Map = () => {
  const [polygons, setPolygons] = useState<FeatureCollection | null>();
  const mapContainerRef = useRef<any>();
  const mapRef = useRef<mapboxgl.Map>();

  useEffect(() => {
    mapboxgl.accessToken = VITE_MAPBOX_ACCESS_TOKEN;

    mapRef.current = new mapboxgl.Map({
      language: "pt-BR",
      container: mapContainerRef.current,
      center: [-46.6388, -23.5489],
      zoom: 5,
    });

    const coordinatesGeocoder = (query: string) => {
      const matches = query.match(
        /^[ ]*(?:Lat: )?(-?\d+\.?\d*)[, ]+(?:Lng: )?(-?\d+\.?\d*)[ ]*$/i
      );
      if (!matches) {
        return null;
      }

      function coordinateFeature(lng: number, lat: number) {
        return {
          center: [lng, lat],
          geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          place_name: "Lat: " + lat + " Lng: " + lng,
          place_type: ["coordinate"],
          properties: {},
          type: "Feature",
        };
      }

      const coord1 = Number(matches[1]);
      const coord2 = Number(matches[2]);
      const geocodes = [];

      if (coord1 < -90 || coord1 > 90) {
        geocodes.push(coordinateFeature(coord1, coord2));
      }

      if (coord2 < -90 || coord2 > 90) {
        geocodes.push(coordinateFeature(coord2, coord1));
      }

      if (geocodes.length === 0) {
        geocodes.push(coordinateFeature(coord1, coord2));
        geocodes.push(coordinateFeature(coord2, coord1));
      }

      return geocodes;
    };

    mapRef.current.addControl(
      new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        localGeocoder: coordinatesGeocoder as any,
        zoom: 4,
        placeholder: "Pesquisar...",
        mapboxgl: mapboxgl as any,
        reverseGeocode: true,
      })
    );

    mapRef.current.addControl(new mapboxgl.FullscreenControl());
    mapRef.current.addControl(new mapboxgl.GeolocateControl());
    mapRef.current.addControl(
      new mapboxgl.NavigationControl({ showZoom: true })
    );

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
    });
    mapRef.current.addControl(draw);

    mapRef.current.on("draw.create", updateArea);
    mapRef.current.on("draw.delete", updateArea);

    function updateArea() {
      const data = draw.getAll();

      if (data.features.length && mapRef.current) {
        data.features.forEach((feat) => {
          mapRef.current?.addSource(feat.id as string, {
            type: "geojson",
            data: feat,
          });

          mapRef.current?.addLayer({
            id: feat.id as string,
            type: "fill",
            source: feat.id as string,
            layout: {},
            paint: {
              "fill-color": "#ff6900",
              "fill-opacity": 0.3,
            },
          });

          mapRef.current?.addLayer({
            id: `${feat.id}-outline`,
            type: "line",
            source: feat.id as string,
            layout: {},
            paint: {
              "line-color": "#ff6900",
              "line-width": 3,
            },
          });
        });

        sessionStorage.setItem("draw", JSON.stringify(data));
        setPolygons(data);
      } else {
        const draw: FeatureCollection = JSON.parse(
          sessionStorage.getItem("draw") || ""
        );

        if (draw) {
          draw?.features.forEach((feat) => {
            mapRef.current?.removeSource(feat.id as string);
            mapRef.current?.removeLayer(feat.id as string);
            mapRef.current?.removeLayer(`${feat.id}-outline`);
          });
          sessionStorage.removeItem("draw");
        }
        setPolygons(null);
      }
    }
  }, []);

  const copyPolygon = (coord: Coordinate, idButton: string) => {
    navigator.clipboard.writeText(JSON.stringify(coord, null, 2));
    const el = document.querySelector(`#${idButton}`);
    if (el) {
      console.log(el);
      el.textContent = "Copiado!";
      setTimeout(() => {
        el.innerHTML = "Copiar localizações do polígonos";
      }, 1000);
    }
  };

  return (
    <main className="h-screen grid grid-cols-12">
      <section className="h-screen grid col-span-9">
        <div ref={mapContainerRef} id="map" className="h-screen" />
      </section>
      <section className="h-screen grid col-span-3 p-4">
        {!polygons && (
          <p className="text-sm text-gray-700 p-8">
            Nenhum polígono criado no mapa.
          </p>
        )}
        {!!polygons && (
          <div className="grid gap-4">
            {polygons.features.map((feature, featIdx) => (
              <div
                key={feature.id}
                className="bg-gray-50 h-fit grid gap-2 pb-4"
              >
                <header className="p-4 mb-2 bg-gray-100">
                  Polígono: {feature.id}
                </header>
                <div className="px-2 grid gap-2 coords">
                  {(
                    (feature.geometry as any).coordinates as Coordinate[][]
                  )[0].map((coord, idx) => (
                    <div
                      className="px-6 py-2 coord"
                      key={`${feature.id}-${idx}`}
                    >
                      <MapPin size={16} /> {coord.join(", ")}
                    </div>
                  ))}
                </div>
                <div className="px-4 mt-2">
                  <button
                    className="w-full py-2 text-sm bg-orange-600 text-white"
                    id={`clip-button${featIdx}`}
                    onClick={() =>
                      copyPolygon(
                        (feature.geometry as any).coordinates[0],
                        `clip-button${featIdx}`
                      )
                    }
                  >
                    Copiar localizações do polígonos
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default Map;
