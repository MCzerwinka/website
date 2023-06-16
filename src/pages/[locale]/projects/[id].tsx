import React from 'react';
import dynamic from 'next/dynamic';
import { GetStaticProps, GetStaticPaths } from 'next';
import { SSRConfig, useTranslation } from 'next-i18next';
import { _cs } from '@togglecorp/fujs';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { remark } from 'remark';
import matter from 'gray-matter';
import html from 'remark-html';

import Hero from 'components/Hero';
import HtmlOutput from 'components/HtmlOutput';
import Section from 'components/Section';

import getProjectCentroids from 'utils/requests/projectCentroids';
import getProjectGeometries from 'utils/requests/projectGeometries';
import getProjectHistory from 'utils/requests/projectHistory';
import { ProjectStatus } from 'utils/common';

import i18nextConfig from '../../../../next-i18next.config';

import styles from './styles.module.css';
import Heading from 'components/Heading';

type DownloadType = (
    'aggregated_results'
    | 'aggregated_results_with_geometry'
    | 'hot_tasking_manager_geometries'
    | 'moderate_to_high_agreement_yes_maybe_geometries'
    | 'groups'
    | 'history'
    | 'results'
    | 'tasks'
    | 'users'
    | 'area_of_interest'
);

type DownloadFileType = 'geojson' | 'csv';

interface UrlInfo {
    name: DownloadType;
    type: DownloadFileType;
    url: string;
    ok: boolean;
    size: number;
}

const DynamicProjectMap = dynamic(() => import('components/ProjectMap'), { ssr: false });

interface Props extends SSRConfig {
    className?: string;
    totalProgress: number | null;
    totalArea: number | null;
    totalContributors: number | null;
    name: string;
    description: string;
    status: ProjectStatus;
    projectGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Polygon> | null;
    urls: UrlInfo[];
}

function Project(props: Props) {
    const {
        className,
        totalProgress,
        totalArea,
        totalContributors,
        name,
        description,
        status,
        projectGeoJSON,
    } = props;

    const { t } = useTranslation('project');

    return (
        <div className={_cs(styles.project, className)}>
            <Hero
                title={name}
            />
            <Section
                className={styles.statsSection}
                contentClassName={styles.content}
            >
                <div className={styles.stats}>
                    <div>
                        {t('project-status-text', { status })}
                    </div>
                    <div>
                        {t('project-progress-text', { progress: totalProgress })}
                    </div>
                    <div>
                        {t('project-total-area-text', { area: totalArea })}
                    </div>
                    <div>
                        {t('project-contributors-text', { contributors: totalContributors })}
                    </div>
                </div>
                <div className={styles.chartContainer}>
                    Chart
                </div>
            </Section>
            <Section className={styles.overviewSection}>
                <div className={styles.overviewContent}>
                    <div className={styles.content}>
                        <Heading size="large">
                            {t('overview-section-title')}
                        </Heading>
                        <div className={styles.description}>
                            <HtmlOutput
                                className={styles.description}
                                content={description}
                            />
                        </div>
                    </div>
                    {projectGeoJSON && (
                        <div className={styles.mapContainer}>
                            <DynamicProjectMap
                                className={styles.projectsMap}
                                geoJSON={projectGeoJSON}
                            />
                        </div>
                    )}
                </div>
            </Section>
        </div>
    );
}

export const getI18nPaths = () => (
    i18nextConfig.i18n.locales.map((lng) => ({
        params: {
            locale: lng,
        },
    }))
);

export const getStaticPaths: GetStaticPaths = async () => {
    const projects = await getProjectCentroids();

    const pathsWithParams = projects.features.flatMap((feature) => {
        const withLocales = i18nextConfig.i18n.locales.map((lng) => ({
            params: {
                id: feature.properties.project_id,
                locale: lng,
            },
        }));
        return withLocales;
    });

    return {
        paths: pathsWithParams,
        fallback: false,
    };
};

export const getStaticProps: GetStaticProps<Props> = async (context) => {
    const locale = context?.params?.locale;
    const projectId = context?.params?.id;

    const translations = await serverSideTranslations(locale as string, [
        'project',
        'common',
    ]);

    const projects = await getProjectCentroids();
    const project = projects.features.find(
        (feature) => feature.properties.project_id === projectId,
    );
    if (!project) {
        throw new Error(`Could not get project ${projectId}`);
    }

    const geojsons = await getProjectGeometries();
    const geojson = geojsons.features.find(
        (feature) => feature.properties.project_id === projectId,
    )?.geometry;

    const historyJSON = await getProjectHistory(project.properties.project_id);

    const matterResult = matter(project.properties.project_details);

    const processedContent = await remark()
        .use(html)
        .process(matterResult.content.replace(/\\n/g, '\n'));
    const contentHtml = processedContent.toString();

    const urls: Omit<UrlInfo, 'size' | 'ok'>[] = [
        {
            name: 'aggregated_results',
            url: `https://apps.mapswipe.org/api/agg_results/agg_results_${projectId}.csv.gz`,
            type: 'csv',
        },
        {
            name: 'aggregated_results_with_geometry',
            url: `https://apps.mapswipe.org/api/agg_results/agg_results_${projectId}_geom.geojson.gz`,
            type: 'geojson',
        },
        {
            name: 'hot_tasking_manager_geometries',
            url: `https://apps.mapswipe.org/api/hot_tm/hot_tm_${projectId}.geojson`,
            type: 'geojson',
        },
        {
            name: 'moderate_to_high_agreement_yes_maybe_geometries',
            url: `https://apps.mapswipe.org/api/yes_maybe/yes_maybe_${projectId}.geojson`,
            type: 'geojson',
        },
        {
            name: 'groups',
            url: `https://apps.mapswipe.org/api/groups/groups_${projectId}.csv.gz`,
            type: 'geojson',
        },
        {
            name: 'history',
            url: `https://apps.mapswipe.org/api/history/history_${projectId}.csv`,
            type: 'geojson',
        },
        {
            name: 'results',
            url: `https://apps.mapswipe.org/api/results/results_${projectId}.csv.gz`,
            type: 'geojson',
        },
        {
            name: 'tasks',
            url: `https://apps.mapswipe.org/api/tasks/tasks_${projectId}.csv.gz`,
            type: 'geojson',
        },
        {
            name: 'users',
            url: `https://apps.mapswipe.org/api/users/users_${projectId}.csv.gz`,
            type: 'geojson',
        },
        {
            name: 'area_of_interest',
            url: `https://apps.mapswipe.org/api/project_geometries/project_geom_${projectId}.geojson`,
            type: 'geojson',
        },
    ];

    const urlResponsePromises = urls.map(async (url) => {
        const res = await fetch(url.url, { method: 'HEAD' });
        return {
            ...url,
            ok: res.ok,
            size: Number(res.headers.get('content-length') ?? '0'),
        };
    });

    const urlResponses = await Promise.all(urlResponsePromises);

    return {
        props: {
            ...translations,
            totalProgress: (
                project.properties.progress !== null
                && project.properties.progress !== undefined
            )
                ? Math.round(project.properties.progress * 100)
                : null,
            totalArea: Math.round(project.properties.area_sqkm ?? 0),
            totalContributors: project.properties.number_of_users ?? null,
            name: project.properties.name,
            description: contentHtml,
            status: project.properties.status,
            projectGeoJSON: geojson ?? null,
            history: historyJSON,
            urls: urlResponses,
        },
    };
};

export default Project;
