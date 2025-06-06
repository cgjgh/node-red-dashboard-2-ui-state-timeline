import { resolve } from 'path'

import vue from '@vitejs/plugin-vue'
import { defineConfig, normalizePath } from 'vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Set to this to the name of this collection of components
// This must match node-red-dashboard-2.widgets[libraryName] in package.json
const LIBRARY_NAME = 'ui-state-timeline'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        cssInjectedByJsPlugin(),
        viteStaticCopy({
            targets: [
                {
                    // Copy the build output into Node-RED's /resources folder
                    src: normalizePath(resolve(__dirname, `./ui/dist/${LIBRARY_NAME}.umd.js`)),
                    dest: normalizePath(resolve(__dirname, 'resources'))
                }
            ]
        })
    ],
    build: {
        // Generate a source map in dev mode
        sourcemap: process.env.NODE_ENV === 'development',

        // Configure build as a UMD library
        lib: {
            entry: resolve(__dirname, 'ui/index.js'),
            name: LIBRARY_NAME,
            formats: ['umd'],
            fileName: (format, entryName) => `${LIBRARY_NAME}.${format}.js`
        },

        // This is the target location for the build output
        outDir: './ui/dist',

        // Declare dependencies that shouldn't be bundled into the library
        rollupOptions: {
            // Don't rollup the Vue dependency into the build
            external: ['vue', 'vuex', 'vuetify'],
            output: {
                // Provide global variables to use in the UMD build
                globals: {
                    vue: 'Vue',
                    vuex: 'vuex'
                }
            }
        }
    }
})
